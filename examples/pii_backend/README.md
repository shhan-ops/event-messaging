# pii_backend

Redis Stream에서 PII 생성 요청을 소비하고 PostgreSQL에 `piis`를 저장한 뒤, 성공/실패 이벤트를 다시 발행하는 샘플 프로젝트입니다.

이 예제는 `event-messaging/examples/pii_backend`에서 `../../` 경로의 `@shhan-ops/event-messaging` 패키지를 직접 참조합니다.

## 필요한 환경 변수

`.env` 예시:

```env
PII_BACKEND_PORT=3002
PII_BACKEND_DB_HOST=127.0.0.1
PII_BACKEND_DB_PORT=5432
PII_BACKEND_DB_USER=postgres
PII_BACKEND_DB_PASSWORD=postgres
PII_BACKEND_DB_NAME=pii_backend
PII_BACKEND_REDIS_URL=redis://default:mypassword@127.0.0.1:6379
```

## 마이그레이션

```bash
npm install
npm run migration:up
```

## 실행

```bash
npm run start:dev
```
