# ConsumerRunner 사용법 (v0.3.0)

`RedisStreamsConsumerRunner`는 **poll 루프(신규 메시지)** 와 **claim 루프(오래된 Pending 메시지)** 를 하나의 클래스로 통합한 고수준 Consumer 실행기입니다.

기존 `RedisStreamsConsumer`가 단일 스트림·단일 루프 구조인 반면, ConsumerRunner는 **다중 스트림 + XAUTOCLAIM 자동화** 까지 처리합니다.

---

## 언제 사용하나

| 상황 | 권장 클래스 |
|---|---|
| 단일 스트림, 단순 소비 | `RedisStreamsConsumer` |
| 다중 스트림 동시 소비 | `RedisStreamsConsumerRunner` |
| XAUTOCLAIM(Pending 재처리)가 필요한 경우 | `RedisStreamsConsumerRunner` |
| ACK 책임을 프레임워크에 위임하고 싶을 때 | `RedisStreamsConsumerRunner` |

---

## 핵심 동작

```
onModuleInit
  └─ ConsumerGroupManager.ensureGroup()   # XGROUP CREATE MKSTREAM (BUSYGROUP 무시)
  └─ RedisStreamsConsumerRunner.start()
       ├─ pollLoop: XREADGROUP → onMessage → (성공) XACK
       │                                   → (실패) ACK 없음, PEL 유지
       └─ claimLoop: XAUTOCLAIM → onMessage → (성공) XACK
                                            → (실패) ACK 없음, PEL 유지
```

**ACK 규칙**: `onMessage` 핸들러가 정상 반환되면 ConsumerRunner가 XACK를 호출합니다.
예외가 발생하면 ACK하지 않으므로 메시지가 PEL(Pending Entry List)에 남아 나중에 claim 루프에서 재처리됩니다.

---

## Import

```ts
import {
  RedisStreamsConsumerGroupManager,
  RedisStreamsSubscriber,
  RedisStreamsConsumerRunner,
} from '@shhan-ops/event-messaging/adapters/redis'

import type {
  ConsumerGroupManagerPort,
  EventSubscriberPort,
  StreamMessage,
} from '@shhan-ops/event-messaging'
```

---

## 기본 예제 — 단일 스트림

```ts
import Redis from 'ioredis'
import {
  RedisStreamsConsumerGroupManager,
  RedisStreamsSubscriber,
  RedisStreamsConsumerRunner,
} from '@shhan-ops/event-messaging/adapters/redis'
import type { EventEnvelope } from '@shhan-ops/event-messaging'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

// 1) Consumer Group 보장
const manager = new RedisStreamsConsumerGroupManager(redis)
await manager.ensureGroup('PII:CREATE:REQ', 'CG_PII')

// 2) Subscriber 생성 (transport 담당)
const subscriber = new RedisStreamsSubscriber(redis)

// 3) Runner 생성 및 시작
const runner = new RedisStreamsConsumerRunner(
  subscriber,
  {
    name: 'pii-stream',
    group: 'CG_PII',
    consumer: 'event-messaging-pii',
    streams: ['PII:CREATE:REQ'],
    readCount: 20,
    readBlockMs: 5000,
    claimMinIdleMs: 300_000,   // 5분 이상 Pending된 메시지를 재소유
    claimCount: 50,
    pollIntervalMs: 100,
  },
  {
    onMessage: async (message) => {
      // envelope field에서 payload 추출
      const idx = message.fields.indexOf('envelope')
      const envelope = JSON.parse(message.fields[idx + 1]) as EventEnvelope<MyPayload>
      await handleEvent(envelope.payload)
      // 반환되면 ConsumerRunner가 자동으로 XACK 호출
    },
  },
)

runner.start()

// 종료 시
process.on('SIGTERM', async () => {
  await runner.stop()
  redis.disconnect()
})
```

---

## 다중 스트림 예제 — OMS PII Outbox

실서비스 OMS backend 패턴입니다. PII 서비스로부터 오는 `CREATED`·`FAILED` 두 스트림을 동시에 소비합니다.

```ts
import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common'
import {
  RedisStreamsConsumerGroupManager,
  RedisStreamsSubscriber,
  RedisStreamsConsumerRunner,
  type RedisLike,
} from '@shhan-ops/event-messaging/adapters/redis'
import type { EventEnvelope, StreamMessage } from '@shhan-ops/event-messaging'

const STREAMS = {
  CREATED: 'PII:CREATED:OMS',
  FAILED:  'PII:FAILED:EVT',
  GROUP:    process.env.PMGO_OMS_PII_CONSUMER_GROUP ?? 'CG_OMS',
  CONSUMER: process.env.PMGO_OMS_PII_CONSUMER_NAME  ?? 'oms-service',
}

@Injectable()
export class PiiOutboxConsumer implements OnModuleInit, OnApplicationShutdown {
  private runner: RedisStreamsConsumerRunner | null = null

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    const redis = this.redisService.getRedisClient() as unknown as RedisLike

    // 두 스트림 모두 Consumer Group 보장
    const manager = new RedisStreamsConsumerGroupManager(redis)
    for (const stream of [STREAMS.CREATED, STREAMS.FAILED]) {
      await manager.ensureGroup(stream, STREAMS.GROUP)
    }

    const subscriber = new RedisStreamsSubscriber(redis)
    this.runner = new RedisStreamsConsumerRunner(
      subscriber,
      {
        name: 'pii-outbox',
        group: STREAMS.GROUP,
        consumer: STREAMS.CONSUMER,
        streams: [STREAMS.CREATED, STREAMS.FAILED],  // 다중 스트림
        claimMinIdleMs: 300_000,
        claimCount: 50,
      },
      {
        onMessage: async (message: StreamMessage) => {
          const payload = extractEnvelopePayload(message.fields)

          if (message.stream === STREAMS.CREATED) {
            await this.handleCreated(payload)
          } else {
            await this.handleFailed(payload)
          }
          // 정상 반환 → ConsumerRunner가 XACK
        },
      },
    )

    this.runner.start()
  }

  onApplicationShutdown() {
    this.runner?.stop()
  }

  private async handleCreated(payload: PiiCreatedPayload) { /* ... */ }
  private async handleFailed(payload: PiiFailedPayload)  { /* ... */ }
}

function extractEnvelopePayload<T>(fields: string[]): T {
  const idx = fields.indexOf('envelope')
  const envelope = JSON.parse(fields[idx + 1]) as EventEnvelope<T>
  return envelope.payload
}
```

---

## ConsumerRunnerConfig 옵션 레퍼런스

| 옵션 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `name` | `string` | — | 로그 식별자 |
| `group` | `string` | — | Consumer Group 이름 |
| `consumer` | `string` | — | Consumer 이름 (Pod/인스턴스별 고유값 권장) |
| `streams` | `string[]` | — | 소비할 스트림 키 목록 |
| `readCount` | `number` | `20` | XREADGROUP 1회 최대 메시지 수 |
| `readBlockMs` | `number` | `5000` | XREADGROUP 블로킹 타임아웃(ms) |
| `pollIntervalMs` | `number` | `100` | poll 루프 간격(ms) |
| `claimMinIdleMs` | `number` | `300_000` | XAUTOCLAIM 최소 idle 시간(ms) — 이 시간 이상 미처리된 메시지를 재소유 |
| `claimCount` | `number` | `50` | XAUTOCLAIM 1회 최대 처리 수 |
| `claimIntervalMs` | `number` | `claimMinIdleMs` | claim 루프 실행 간격(ms) |

---

## onError 핸들러

`onMessage`에서 발생한 예외는 기본적으로 `console.error`로 출력됩니다. 커스텀 처리가 필요하면 `onError`를 추가합니다.

```ts
{
  onMessage: async (message) => { /* ... */ },
  onError: async (error) => {
    await alertingService.report(error)
  },
}
```

`onError`가 설정되면 기본 `console.error` 출력은 생략됩니다.

---

## 개별 포트 직접 사용

ConsumerRunner 없이 포트를 직접 사용할 수도 있습니다.

```ts
import {
  RedisStreamsSubscriber,
  RedisStreamsConsumerGroupManager,
} from '@shhan-ops/event-messaging/adapters/redis'

const manager = new RedisStreamsConsumerGroupManager(redis)
await manager.ensureGroup('my-stream', 'my-group')

const subscriber = new RedisStreamsSubscriber(redis)

// 직접 read / ack / claim
const messages = await subscriber.read({
  group: 'my-group',
  consumer: 'my-consumer',
  streams: ['my-stream'],
  count: 10,
  blockMs: 3000,
})

for (const msg of messages) {
  await processMessage(msg)
  await subscriber.ack(msg.stream, 'my-group', msg.messageId)
}

// Pending 메시지 재소유
const claimed = await subscriber.claim({
  stream: 'my-stream',
  group: 'my-group',
  consumer: 'my-consumer',
  minIdleMs: 300_000,
  startId: '0-0',
  count: 50,
})
```

---

## `createReadParams` / `createClaimParams` 헬퍼

`ConsumerRunnerConfig`로부터 파라미터 객체를 생성하는 편의 함수입니다. ConsumerRunner 없이 직접 루프를 구성할 때 유용합니다.

```ts
import {
  createReadParams,
  createClaimParams,
} from '@shhan-ops/event-messaging/adapters/redis'

const config = {
  name: 'my-runner',
  group: 'CG_MY',
  consumer: 'my-svc',
  streams: ['stream-a', 'stream-b'],
  readCount: 10,
  claimMinIdleMs: 60_000,
}

const readParams  = createReadParams(config)
// → { group: 'CG_MY', consumer: 'my-svc', streams: [...], count: 10, blockMs: 5000 }

const claimParams = createClaimParams(config, 'stream-a')
// → { stream: 'stream-a', group: 'CG_MY', consumer: 'my-svc', minIdleMs: 60000, count: 50, startId: '0-0' }
```

---

## `RedisStreamsConsumer`와의 비교

| | `RedisStreamsConsumer` | `RedisStreamsConsumerRunner` |
|---|---|---|
| **스트림 수** | 단일 | 다중 |
| **XAUTOCLAIM** | 없음 | 자동 (claim 루프) |
| **ACK 모드** | auto / manual | 성공 시 자동 ACK |
| **Graceful shutdown** | drain / immediate | stop() (타이머 정리 + close) |
| **NestJS 의존성** | 없음 | 없음 |
| **Consumer Group 생성** | start() 내부에서 자동 | `RedisStreamsConsumerGroupManager.ensureGroup()` 별도 호출 |
