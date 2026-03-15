# examples

`event-messaging` 패키지를 실제 서비스에 붙이는 샘플 모음입니다.

- `service-integration`: 최소 wiring 예제
- `oms_backend`: sample-order 저장 + outbox 발행 예제
- `pii_backend`: PII 생성 소비 + 결과 이벤트 발행 예제

권장 실행 순서:

```bash
cd examples/pii_backend && npm install && npm run migration:up && npm run start:dev
cd examples/oms_backend && npm install && npm run migration:up && npm run start:dev
```
