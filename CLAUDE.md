# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 언어 규칙

- **모든 커밋 메시지는 한글로 작성한다**
- **모든 코드 주석은 한글로 작성한다**
- **Claude와의 대화 및 응답은 한글로 한다**

## 주요 명령어

```bash
# 빌드 (CJS + ESM + 타입 선언 생성)
npm run build

# 테스트 실행
npm test

# 특정 테스트 파일 실행
npx jest test/core/envelope.spec.ts
npx jest test/adapters/redis/redisPublisher.spec.ts

# 타입 검사
npm run type-check

# 빌드 결과물 정리
npm run clean

# 릴리즈 (patch / minor / major)
npm run release:patch
npm run release:minor
npm run release:major
```

## 아키텍처

이 패키지는 **브로커 독립적 추상화 레이어**로 설계된 이벤트 메시징 라이브러리다. 코어 인터페이스와 브로커별 구현체를 분리하여 다양한 메시지 브로커를 교체 가능하게 한다.

### 레이어 구조

```
core/          ← 브로커 독립적인 도메인 인터페이스 (Port)
adapters/      ← 브로커별 구현체 (Adapter)
test/          ← core/ 및 adapters/ 구조를 미러링
```

### `core/` — Port 인터페이스

- `types/envelope.ts` — `EventEnvelope<T>`: 모든 이벤트의 표준 봉투 타입. `eventId`, `type`, `occurredAt`, `source`, `schemaVersion`, `payload`, `headers`를 포함한다.
- `types/message.ts` — `Message<T>`: 브로커에서 수신한 메시지(봉투 + 전송 레이어 메타). `PublishResult`: 발행 결과.
- `ports/publisher.ts` — `EventPublisherPort<T>`, `EventTypeRouter`: 이벤트 타입 → 브로커 destination 라우팅 인터페이스.
- `ports/consumer.ts` — `EventConsumerPort<T>`: auto-ack / manual-ack 핸들러, concurrency, graceful shutdown 옵션 포함.

### `adapters/redis/` — Redis Streams 구현체

- **`RedisStreamsPublisher`**: `XADD`로 이벤트를 발행. `EventTypeRouter`로 스트림 키를 결정하며, `maxLenApprox` 옵션으로 `MAXLEN ~` trim을 지원한다.
- **`RedisStreamsConsumer`**: `XREADGROUP`으로 Consumer Group 기반 소비. `ensureConsumerGroup()`으로 그룹 자동 생성, `decodeErrorPolicy`로 잘못된 JSON 처리, drain 모드 graceful shutdown을 지원한다.
- **`RedisLike`** (`types.ts`): ioredis에 직접 의존하지 않는 duck-type 인터페이스. 테스트 시 mock으로 교체 가능하다.

### 패키지 엔트리포인트

| Import 경로 | 소스 파일 |
|---|---|
| `@shhan-ops/event-messaging` | `core/index.ts` |
| `@shhan-ops/event-messaging/adapters/redis` | `adapters/redis/index.ts` |

### 빌드 출력

`tsup`으로 CJS(`.js`) + ESM(`.mjs`) + 타입 선언(`.d.ts`)을 동시에 생성하며 `dist/`에 위치한다.

### 새 어댑터 추가 방법

`adapters/<브로커명>/` 디렉토리를 생성하고, `EventPublisherPort` 또는 `EventConsumerPort`를 구현한 뒤 `tsup.config.ts`의 `entry`에 등록하고 `package.json`의 `exports`에 경로를 추가한다.
