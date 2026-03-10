# service-integration 예제

이 폴더는 실제 서비스에 `@shhan-ops/event-messaging`을 적용할 때 사용할 수 있는 샘플 코드를 제공합니다.

- `bootstrap.ts`: router + redis adapter wiring
- `order-publisher.service.ts`: OMS 스타일 이벤트 발행
- `order-created.handler.ts`: PII 스타일 멱등성 소비
- `protobuf-payload.example.ts`: 현재 구현과 호환되는 Protobuf payload wrapper 예제

주의:

- 이 코드는 문서용 예시이며, 프로젝트의 DI/로깅/트랜잭션 유틸에 맞게 조정해야 합니다.
