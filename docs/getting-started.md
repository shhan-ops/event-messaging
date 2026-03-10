# 시작하기

## 요구사항

- Node.js `>=22`
- npm
- (문서 로컬 실행 시) Python 3.11+

## 설치

```bash
npm ci
```

## 빌드/테스트

```bash
npm test
npm run build
```

## 패키지 공개 API

```ts
// Core — 타입 및 포트 인터페이스
import type {
  EventEnvelope,
  EventPublisherPort,
  EventConsumerPort,
  // v0.3.0 추가
  EventSubscriberPort,
  ConsumerGroupManagerPort,
  StreamMessage,
  ReadGroupParams,
  ClaimPendingParams,
} from '@shhan-ops/event-messaging'

// Redis Adapter — 구현체
import {
  RedisStreamsPublisher,
  RedisStreamsConsumer,
  // v0.3.0 추가
  RedisStreamsConsumerGroupManager,
  RedisStreamsSubscriber,
  RedisStreamsConsumerRunner,
  createReadParams,
  createClaimParams,
} from '@shhan-ops/event-messaging/adapters/redis'
```

## 문서 로컬 미리보기

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-docs.txt
mkdocs serve
```

브라우저에서 `http://127.0.0.1:8000` 접속

## 첫 적용 순서

**Publisher만 필요한 경우:**

1. 서비스 bootstrap에서 Redis client/Router를 구성
2. `RedisStreamsPublisher`를 생성해 애플리케이션 서비스에 `EventPublisherPort`로 주입

**단일 스트림 소비 (기존 방식):**

1. `RedisStreamsConsumer`를 생성하고 `.start(handler)`로 루프 실행
2. 종료 시 `consumer.stop({ mode: 'drain' })`로 graceful shutdown

**다중 스트림 소비 또는 XAUTOCLAIM 필요 시 (v0.3.0):**

1. `RedisStreamsConsumerGroupManager.ensureGroup()`으로 Consumer Group 보장
2. `RedisStreamsSubscriber`와 `RedisStreamsConsumerRunner`를 조합해 루프 실행
3. 종료 시 `runner.stop()`으로 타이머·연결 정리

→ 자세한 내용: [ConsumerRunner 사용법](usage/consumer-runner.md)
