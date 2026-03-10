# 발행(Publisher) 사용법

## 핵심 동작

`RedisStreamsPublisher.publish()`는 내부적으로 다음 규칙을 가집니다.

1. destination 결정
2. `EventEnvelope` JSON 직렬화
3. `XADD` 실행
4. `PublishResult { messageId, destination }` 반환

## 기본 예제

```ts
import Redis from 'ioredis'
import { RedisStreamsPublisher } from '@shhan-ops/event-messaging/adapters/redis'
import type { EventEnvelope, EventTypeRouter } from '@shhan-ops/event-messaging'

const router: EventTypeRouter = {
  resolve(eventType: string): string {
    const table: Record<string, string> = {
      'order.created.v1': 'stream:orders',
      'order.cancelled.v1': 'stream:orders',
      'payment.completed.v1': 'stream:payments',
    }
    const destination = table[eventType]
    if (!destination) throw new Error(`Unknown eventType: ${eventType}`)
    return destination
  },
}

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const publisher = new RedisStreamsPublisher(redis, {
  router,
  maxLenApprox: 100_000,
})

const envelope: EventEnvelope<{ orderId: number; partnerId: number }> = {
  eventId: crypto.randomUUID(),
  type: 'order.created.v1',
  occurredAt: new Date().toISOString(),
  source: 'oms-order-service',
  schemaVersion: 1,
  payload: { orderId: 1001, partnerId: 77 },
  headers: {
    traceId: 'trace-123',
    correlationId: 'order-create-flow-1',
  },
}

const result = await publisher.publish(envelope)
console.log(result)
```

## destination override 예제

```ts
await publisher.publish(envelope, { destination: 'stream:orders:priority' })
```

- override가 있으면 router를 사용하지 않습니다.
- 운영 배치/재전송 시 특정 stream으로 우회할 때 사용 가능합니다.

## Stream Retention (MAXLEN)

`maxLenApprox`를 설정하면 아래 형태로 `XADD`가 호출됩니다.

```text
XADD <destination> MAXLEN ~ <N> * envelope "<json>"
```

- 대략적인 길이 제한으로 stream 무한 증가를 완화
- `~`는 approximate trimming으로 Redis 부하를 줄여줌

## 실패 케이스

- `xadd`가 `null`을 반환하면 예외 발생
- Redis 네트워크/권한 오류는 상위로 전파

호출부에서 재시도/알림 정책을 별도로 가져가는 것을 권장합니다.
