# event-messaging

공통 이벤트 메시징 패키지입니다.

- Core API: `@shhan-ops/event-messaging`
- Redis Adapter: `@shhan-ops/event-messaging/adapters/redis`

## 빠른 사용 예시

```ts
import Redis from 'ioredis'
import { RedisStreamsPublisher } from '@shhan-ops/event-messaging/adapters/redis'
import type { EventTypeRouter } from '@shhan-ops/event-messaging'

const router: EventTypeRouter = {
  resolve(type) {
    return type.startsWith('order.') ? 'stream:orders' : 'stream:default'
  },
}

const redis = new Redis('redis://localhost:6379')
const publisher = new RedisStreamsPublisher(redis, { router })
```

자세한 내용은 `docs/`를 참고하세요.
