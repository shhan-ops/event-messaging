# event-messaging 문서

`@shhan-ops/event-messaging`은 공통으로 사용하는 **브로커 중립 이벤트 메시징 라이브러리**입니다.

- Core (`@shhan-ops/event-messaging`): 이벤트 표준 타입/포트
- Redis Adapter (`@shhan-ops/event-messaging/adapters/redis`): Redis Streams 구현

이 문서는 다음 2가지를 동시에 반영합니다.

1. 초기 MVP 설계 문서의 설계 원칙
2. 현재 `event-messaging` 코드의 실제 동작

## 빠른 링크

- [시작하기](getting-started.md)
- [아키텍처 개요](architecture/overview.md)
- [Protobuf 전략](architecture/protobuf-strategy.md)
- [발행(Publisher) 사용법](usage/publishing.md)
- [소비(Consumer) 사용법](usage/consuming.md)
- [ConsumerRunner 사용법](usage/consumer-runner.md) ← v0.3.0 신규
- [실제 서비스 적용 예제](usage/service-integration.md)
- [Redis 운영 Runbook](operations/redis-runbook.md)
- [트러블슈팅](troubleshooting.md)

## 현재 구현 상태 요약

| 항목 | 설계 방향 | 현재 코드 상태                                          |
|---|---|---------------------------------------------------|
| 패키지 구조 | Core + Redis Adapter 단일 패키지 | 구현 완료                                             |
| EventEnvelope 표준 | 공통 메타 + payload | 구현 완료                                             |
| Publisher 라우팅 | `type -> destination`, override 가능 | 구현 완료                                             |
| Consumer ack 모드 | auto/manual + 누락 정책 | 구현 완료                                             |
| decodeErrorPolicy | `ack` / `skip` | 구현 완료                                             |
| Graceful stop | drain/immediate + timeout | 구현 완료                                             |
| 다중 스트림 소비 | 여러 스트림 동시 XREADGROUP | v0.3.0 구현 완료 (`RedisStreamsConsumerRunner`)       |
| XAUTOCLAIM (Pending 재처리) | 오래된 메시지 자동 재소유 | v0.3.0 구현 완료 (`RedisStreamsConsumerRunner`)       |
| Consumer Group 관리 | `XGROUP CREATE MKSTREAM` 추상화 | v0.3.0 구현 완료 (`RedisStreamsConsumerGroupManager`) |
| 동시성(concurrency) | 옵션 제공 | 타입 정의만 존재, 로직 미적용                                 |
| Protobuf payload 분리 필드 | `payload_bin` 등 확장 | 설계만 존재, 현재는 envelope JSON 단일 필드                   |

## 문서 운영 원칙

- 문서 변경은 PR로 반영
- `main` 반영 시 GitHub Pages 자동 배포 (`.github/workflows/docs.yml`)
