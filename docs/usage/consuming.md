# 소비(Consumer) 사용법

## 핵심 동작

`RedisStreamsConsumer.start()`는 다음 흐름으로 동작합니다.

1. `XGROUP CREATE ... MKSTREAM`으로 Consumer Group 보장
2. `XREADGROUP` 루프 실행
3. `envelope` 필드 JSON 파싱
4. 핸들러 실행 + ACK 정책 적용

## 기본 설정 예제

```ts
import Redis from 'ioredis'
import { RedisStreamsConsumer } from '@shhan-ops/event-messaging/adapters/redis'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

const consumer = new RedisStreamsConsumer(redis, {
  streamKey: 'stream:orders',
  group: 'pii-masker-group',
  consumer: `pii-masker-${process.env.POD_NAME ?? 'local'}`,
  blockMs: 2000,
  count: 10,
  decodeErrorPolicy: 'ack',
})
```

## auto ack (기본)

```ts
await consumer.start(async (message) => {
  // 성공적으로 반환되면 자동 XACK
  await processOrderCreated(message.envelope.payload)
})
```

- 장점: ack 누락 버그를 구조적으로 줄임
- 실패(예외) 시 ACK하지 않음 -> PEL 잔류

## manual ack

```ts
await consumer.start(
  async (message, ack) => {
    await processOrderCreated(message.envelope.payload)
    await ack()
  },
  {
    ackMode: 'manual',
    onAckMissing: 'error',
  },
)
```

`onAckMissing` 정책:

- `warn` (기본)
- `error`
- `autoAck`

## decodeErrorPolicy

- `ack` (기본): 잘못된 메시지를 ACK하여 소비 루프 정체 방지
- `skip`: ACK하지 않고 pending에 남김(수동 점검/재처리 전제)

## stop() / graceful shutdown

```ts
// 기본: drain
await consumer.stop({ mode: 'drain', drainTimeoutMs: 30_000 })

// 강제 중단
await consumer.stop({ mode: 'immediate' })
```

- `drain`: 처리 중(in-flight) 메시지 완료를 기다림
- `immediate`: 즉시 리턴, in-flight ACK 미보장

## 현재 구현 주의사항

`ConsumerOptions`에 `concurrency` 필드가 정의되어 있지만, 현재 `RedisStreamsConsumer` 구현에서는 실제 병렬 처리에 사용되지 않습니다. 즉 현재 처리 모델은 직렬 처리에 가깝게 동작합니다.

---

## 다중 스트림 소비 / XAUTOCLAIM이 필요하다면

`RedisStreamsConsumer`는 단일 스트림 전용입니다. 다음 경우에는 `RedisStreamsConsumerRunner`를 사용하세요.

- 여러 스트림을 하나의 Consumer Group으로 동시 소비
- XAUTOCLAIM으로 Pending 메시지를 자동 재소유
- Consumer Group 생성(`XGROUP CREATE MKSTREAM`)을 명시적으로 분리하고 싶을 때

→ [ConsumerRunner 사용법](consumer-runner.md)
