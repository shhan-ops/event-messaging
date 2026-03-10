# 아키텍처 개요

## 목표

`event-messaging`의 핵심 목표는 애플리케이션 레이어가 브로커 구현 세부사항을 몰라도 이벤트를 발행/소비할 수 있게 하는 것입니다.

## 패키지 구조

```text
event-messaging/
├── core/
│   ├── types/
│   │   ├── envelope.ts
│   │   └── message.ts
│   ├── ports/
│   │   ├── publisher.ts
│   │   └── consumer.ts
│   └── index.ts
├── adapters/
│   └── redis/
│       ├── redisPublisher.ts
│       ├── redisConsumer.ts
│       ├── types.ts
│       └── index.ts
```

## 레이어 의존성 규칙

- 애플리케이션/도메인: `@shhan-ops/event-messaging` (core)만 import
- 인프라/bootstrap: `@shhan-ops/event-messaging/adapters/redis` import 허용

```ts
// application service (허용)
import type { EventPublisherPort, EventEnvelope } from '@shhan-ops/event-messaging'

// bootstrap (허용)
import { RedisStreamsPublisher, RedisStreamsConsumer } from '@shhan-ops/event-messaging/adapters/redis'
```

## EventEnvelope 표준

`EventEnvelope<T>` 필수 필드:

- `eventId`
- `type`
- `occurredAt`
- `source`
- `schemaVersion`
- `payload`
- `headers?`

권장 헤더 키 상수(`ENVELOPE_HEADER_KEYS`)도 core에 제공됩니다.

## Publisher Port

- 인터페이스: `publish(envelope, options?)`
- destination 결정 순서:
1. `options.destination` 지정 시 override
2. 미지정 시 `EventTypeRouter.resolve(envelope.type)`

Redis adapter는 위 destination을 Redis stream key로 사용해 `XADD`를 실행합니다.

## Consumer Port

- 인터페이스: `start(handler, options?)`, `stop(options?)`
- ack 모드:
  - `autoOnSuccess` (기본): 핸들러 성공 후 자동 ACK
  - `manual`: 핸들러가 `ack()` 직접 호출
- decode 오류 정책:
  - `ack` (기본): 독성 메시지 ACK 처리
  - `skip`: ACK하지 않고 pending으로 남김
- shutdown 모드:
  - `drain` (기본)
  - `immediate`

## at-least-once 전제

현재 Redis Streams 소비 모델은 **at-least-once**입니다.

- 핸들러 실패/크래시 시 메시지는 PEL(Pending Entries List)에 남을 수 있음
- 따라서 핸들러는 반드시 멱등성(Inbox table, unique key 등)을 가져야 함

## 설계 대비 차이점 (중요)

- `ConsumerOptions.concurrency`는 타입에 존재하지만, 현재 `RedisStreamsConsumer` 로직에서 실제 병렬 처리에 사용되지 않습니다.
- Protobuf 분리 필드(`payload_bin`) 저장 구조는 아직 구현되지 않았습니다. 현재는 `envelope` JSON 단일 필드 구조입니다.
- `XAUTOCLAIM` 재처리 루프 / DLQ는 아직 구현되지 않았습니다.
