# 실제 서비스 적용 예제

이 문서는 실제 서비스에 바로 적용할 수 있는 패턴을 예제로 정리합니다.

- 예제 코드 원본: `examples/service-integration/`
- 적용 대상: OMS/PII/NOW 등 Node.js + Redis 기반 서비스

## 예제 1. OMS에서 OrderCreated 이벤트 발행

```ts
import type { EventEnvelope, EventPublisherPort } from '@shhan-ops/event-messaging'

export class OmsOrderService {
  constructor(private readonly publisher: EventPublisherPort) {}

  async createOrder(orderId: number, partnerId: number): Promise<void> {
    // 1) 도메인 트랜잭션 처리
    // ...

    // 2) 이벤트 발행
    const envelope: EventEnvelope<{ orderId: number; partnerId: number }> = {
      eventId: crypto.randomUUID(),
      type: 'order.created.v1',
      occurredAt: new Date().toISOString(),
      source: 'oms-order-service',
      schemaVersion: 1,
      payload: { orderId, partnerId },
      headers: {
        traceId: 'trace-from-request',
        correlationId: `order-${orderId}`,
        partnerId: String(partnerId),
      },
    }

    await this.publisher.publish(envelope)
  }
}
```

핵심 포인트:

- 앱 서비스는 core만 의존
- destination 결정은 bootstrap router 책임

## 예제 2. PII 서비스에서 멱등성 소비

```ts
import type { Message } from '@shhan-ops/event-messaging'

interface InboxRepository {
  exists(eventId: string): Promise<boolean>
  save(eventId: string): Promise<void>
}

export class OrderCreatedHandler {
  constructor(private readonly inbox: InboxRepository) {}

  async handle(message: Message<{ orderId: number; partnerId: number }>): Promise<void> {
    const { eventId, payload } = message.envelope

    // 중복 메시지 방지
    if (await this.inbox.exists(eventId)) {
      return
    }

    await runInTransaction(async () => {
      await maskOrderPii(payload.orderId, payload.partnerId)
      await this.inbox.save(eventId)
    })
  }
}
```

핵심 포인트:

- at-least-once 모델에서 멱등성은 필수
- 중복 수신 시에도 안전하게 성공 처리 후 ACK 가능

## 예제 3. NestJS bootstrap wiring

```ts
import Redis from 'ioredis'
import { RedisStreamsPublisher, RedisStreamsConsumer } from '@shhan-ops/event-messaging/adapters/redis'
import type { EventTypeRouter } from '@shhan-ops/event-messaging'

const router: EventTypeRouter = {
  resolve(eventType: string): string {
    const table: Record<string, string> = {
      'order.created.v1': 'stream:orders',
      'order.cancelled.v1': 'stream:orders',
      'pii.masked.v1': 'stream:pii',
    }
    const destination = table[eventType]
    if (!destination) throw new Error(`Unknown eventType: ${eventType}`)
    return destination
  },
}

const redisForPub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const redisForCon = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

export const publisher = new RedisStreamsPublisher(redisForPub, {
  router,
  maxLenApprox: 100_000,
})

export const consumer = new RedisStreamsConsumer(redisForCon, {
  streamKey: 'stream:orders',
  group: 'pii-masker-group',
  consumer: `pii-masker-${process.env.POD_NAME ?? 'local'}`,
  decodeErrorPolicy: 'ack',
})

await consumer.start(async (message) => {
  await orderCreatedHandler.handle(message)
})

process.on('SIGTERM', async () => {
  await consumer.stop({ mode: 'drain', drainTimeoutMs: 30_000, onDrainTimeout: 'force' })
  redisForCon.disconnect()
  redisForPub.disconnect()
  process.exit(0)
})
```

## 예제 4. Protobuf payload를 현재 구조에 적용하는 방법

현재 adapter는 `envelope` JSON 단일 필드 구조이므로, payload를 base64 문자열로 감싸는 전략이 실무적으로 안전합니다.

```ts
import { OrderCreated } from '../generated/events/order/v1/order_created'

const payloadBytes = OrderCreated.encode({
  orderId: 1234,
  partnerId: 77,
}).finish()

await publisher.publish({
  eventId: crypto.randomUUID(),
  type: 'order.created.v1',
  occurredAt: new Date().toISOString(),
  source: 'oms-order-service',
  schemaVersion: 1,
  payload: {
    codec: 'protobuf',
    messageType: 'order.v1.OrderCreated',
    payloadBase64: Buffer.from(payloadBytes).toString('base64'),
  },
})
```

컨슈머 측:

```ts
const raw = message.envelope.payload as {
  codec: string
  messageType: string
  payloadBase64: string
}

if (raw.codec === 'protobuf' && raw.messageType === 'order.v1.OrderCreated') {
  const decoded = OrderCreated.decode(Buffer.from(raw.payloadBase64, 'base64'))
  // decoded 사용
}
```

## 예제 5. ConsumerRunner — NestJS 서비스에 적용 (v0.3.0)

다중 스트림과 XAUTOCLAIM이 필요한 경우의 NestJS 통합 패턴입니다.

```ts
import { Injectable, OnModuleInit, OnApplicationShutdown } from '@nestjs/common'
import {
  RedisStreamsConsumerGroupManager,
  RedisStreamsSubscriber,
  RedisStreamsConsumerRunner,
  type RedisLike,
} from '@shhan-ops/event-messaging/adapters/redis'
import type { EventEnvelope, StreamMessage } from '@shhan-ops/event-messaging'

@Injectable()
export class PiiOutboxConsumer implements OnModuleInit, OnApplicationShutdown {
  private runner: RedisStreamsConsumerRunner | null = null

  constructor(private readonly redisService: RedisService) {}

  async onModuleInit() {
    const redis = this.redisService.getRedisClient() as unknown as RedisLike

    // Consumer Group 보장 — 없으면 생성, 이미 있으면 무시
    const manager = new RedisStreamsConsumerGroupManager(redis)
    for (const stream of ['PII:CREATED:OMS', 'PII:FAILED:EVT']) {
      await manager.ensureGroup(stream, 'CG_OMS')
    }

    const subscriber = new RedisStreamsSubscriber(redis)
    this.runner = new RedisStreamsConsumerRunner(
      subscriber,
      {
        name: 'pii-outbox',
        group: 'CG_OMS',
        consumer: 'oms-service',
        streams: ['PII:CREATED:OMS', 'PII:FAILED:EVT'],
        claimMinIdleMs: 300_000,
        claimCount: 50,
      },
      {
        onMessage: async (message: StreamMessage) => {
          const payload = this.extractPayload(message.fields)
          if (message.stream === 'PII:CREATED:OMS') {
            await this.handleCreated(payload)
          } else {
            await this.handleFailed(payload)
          }
          // 정상 반환 → ConsumerRunner가 자동으로 XACK
        },
      },
    )

    this.runner.start()
  }

  onApplicationShutdown() {
    this.runner?.stop()
  }

  private extractPayload<T>(fields: string[]): T {
    const idx = fields.indexOf('envelope')
    const envelope = JSON.parse(fields[idx + 1]) as EventEnvelope<T>
    return envelope.payload
  }

  private async handleCreated(payload: any) { /* ... */ }
  private async handleFailed(payload: any)  { /* ... */ }
}
```

핵심 포인트:

- `ConsumerGroupManager.ensureGroup()`을 `onModuleInit` 초반에 호출해 스트림/그룹을 보장
- `onMessage`에서 예외가 발생하면 ACK하지 않으므로 PEL에 남아 `claimMinIdleMs` 경과 후 자동 재처리
- NestJS 의존성 없이 순수 `RedisLike` 인터페이스만 사용 → 테스트 시 mock 교체 용이

## 적용 체크리스트

- [ ] 이벤트 타입별 router 테이블 운영
- [ ] handler 멱등성(Inbox/unique) 보장
- [ ] `decodeErrorPolicy`를 기본 `ack`로 운영 시작
- [ ] graceful shutdown(`stop({ mode: 'drain' })`) 적용
- [ ] PEL/XLEN 모니터링 대시보드 구축
