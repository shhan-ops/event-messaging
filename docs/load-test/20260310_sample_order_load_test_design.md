# sample_order API 부하테스트 설계

작성일: 2026-03-10
대상 서비스:
- `poomgo_oms_backend`
- `poomgo_pii`

관련 구현 참고:
- `poomgo_oms_backend/src/sample-order/sample-order.controller.ts`
- `poomgo_oms_backend/src/sample-order/sample-order.service.ts`
- `poomgo_oms_backend/src/pii-outbox/schedule/pii-outbox.publisher.ts`
- `poomgo_oms_backend/src/pii-outbox/stream/pii-outbox.consumer.ts`
- `poomgo_pii/src/pii/stream/pii-stream.consumer.ts`
- `poomgo_pii/src/pii/stream/pii-stream.service.ts`

---

## 1. 목적

`sample_order` API 부하테스트의 목적은 단순 HTTP 처리량 측정이 아니다.
아래 4개 구간을 함께 검증해야 한다.

1. OMS API 수신 및 DB 저장
2. OMS `pii_outbox` 적재
3. OMS -> Redis Streams -> PII 처리
4. PII 결과를 OMS가 다시 소비하여 `sample_orders.pii_id` 반영

즉, 이번 테스트는 다음 두 계층을 분리해 측정한다.

- `API 성능`: `POST /sample-order` 응답시간과 오류율
- `종단 성능`: 주문 생성부터 `pii_outbox.status=COMPLETED`, `sample_orders.pii_id` 반영까지의 시간

---

## 2. 범위

### 2.1 포함

- `POST /sample-order`
- `GET /sample-order/:id`
- OMS `sample_orders`, `pii_outbox`
- Redis Streams
  - `PII:CREATE:REQ`
  - `PII:CREATED:OMS`
  - `PII:FAILED:EVT`
- PII stream consumer / service 처리

### 2.2 제외

- `POST /sample-order/seed`
- 운영 외부 연동
- 프런트엔드

`POST /sample-order/seed`는 내부에서 순차 루프로 `createSampleOrder()`를 반복 호출하므로, 동시성 부하 시나리오의 기준 API로 사용하지 않는다.

---

## 3. 현재 구조 요약

### 3.1 요청 처리 흐름

1. 클라이언트가 `POST /sample-order` 호출
2. OMS가 `sample_orders` row 생성
3. OMS가 `pii_outbox` row 생성
4. OMS가 `sample_orders.pii_outbox_id` 업데이트
5. OMS outbox publisher가 주기적으로 `PII:CREATE:REQ` 발행
6. PII가 요청을 소비하고 `createOrReuseFromStream()` 수행
7. PII가 성공 시 `PII:CREATED:OMS`, 실패 시 `PII:FAILED:EVT` 발행
8. OMS consumer가 결과를 반영해 `pii_outbox` 상태와 `sample_orders.pii_id`를 업데이트

### 3.2 구조상 중요한 제약

- `orderNo`는 유니크다.
- OMS outbox 발행은 cron 기반이며 `EVERY_5_SECONDS`로 동작한다.
- OMS outbox 발행 batch size 기본값은 `50`이다.
- 따라서 HTTP API가 빨라도 비동기 구간에서 backlog가 쌓일 수 있다.

주의:
위 기본값 기준이면 스케줄러 인스턴스 1개에서 이론상 종단 처리량이 초당 약 10건 수준으로 제한될 수 있다.
이 수치는 코드 설정 기반 추정치이며, 실제 성능은 pod 수와 runtime 설정에 따라 달라진다.

---

## 4. 테스트 목표

### 4.1 기능 목표

- 동시 요청 시 `sample_orders` 중복 생성이 없어야 한다.
- 같은 `orderNo` 경합 시 기존 주문 재사용 로직이 정상 동작해야 한다.
- 정상 요청은 최종적으로 `pii_outbox.status=COMPLETED`여야 한다.
- 정상 요청은 최종적으로 `sample_orders.pii_id`가 채워져야 한다.

### 4.2 성능 목표 초안

초기 권장 SLO 초안:

- OMS API `POST /sample-order`
  - success rate >= 99.9%
  - p95 <= 500ms
  - p99 <= 1000ms
- 종단 완료시간
  - p95 <= 15s
  - p99 <= 30s
- 정상 부하 구간에서
  - `FAILED = 0`
  - `DLQ = 0`
- 테스트 종료 후 backlog drain time
  - 5분 이내 정상화

운영 환경 스펙에 따라 위 기준은 조정 가능하다.

---

## 5. 측정 지표

### 5.1 API 계층

- RPS
- status code 분포
- p50 / p95 / p99 latency
- timeout 비율

### 5.2 OMS 계층

- `sample_orders` insert 건수
- `pii_outbox` 상태별 건수
- `INIT`, `REQUESTED`, `RETRY_PENDING`, `FAILED`, `DLQ` 증가 추이
- cron publish 처리량

### 5.3 PII 계층

- `PII:CREATE:REQ` consume 처리량
- 성공/실패 이벤트 발행량
- PII 처리시간
- retryable / non-retryable 실패 비율

### 5.4 종단 계층

- 주문 생성 시각부터 `pii_id` 반영까지의 시간
- backlog 최대치
- backlog 회복 시간

---

## 6. 테스트 데이터 원칙

### 6.1 기본 원칙

- 해피패스 부하에서는 모든 요청의 `orderNo`를 고유하게 생성한다.
- 수령인 정보는 고정 템플릿을 사용해도 무방하다.
- 단, `orderNo`만 고유하게 바뀌어야 중복 흡수 로직이 아닌 순수 처리량을 측정할 수 있다.

### 6.2 중복 시나리오 원칙

- 전체 요청 중 일부는 동일 `orderNo`를 의도적으로 재전송한다.
- 목적은 TPS 확보가 아니라, 경합 시 중복 생성 방지 로직과 idempotency 동작 확인이다.

### 6.3 권장 payload 템플릿

```json
{
  "orderNo": "LT-20260310-000001",
  "recipientName": "Load Test User",
  "recipientPhonePrimary": "01012345678",
  "recipientCountry": "KR",
  "recipientFullAddress": "서울시 강남구 테헤란로 123",
  "recipientPostalCode": "06236",
  "deliveryMessage": "load-test"
}
```

---

## 7. 권장 시나리오

### 7.1 시나리오 A: OMS API 기준선

목적:
- OMS HTTP + DB write path의 기본 성능 확인

방법:
- `POST /sample-order`만 호출
- 종단 완료시간은 보조 지표로만 수집
- 단계별 RPS를 10분 단위로 상승

권장 단계:
- 1 RPS, 3 RPS, 5 RPS, 8 RPS, 10 RPS

성공 기준:
- HTTP 오류율이 거의 없어야 함
- latency가 급격히 튀는 지점 파악

### 7.2 시나리오 B: E2E 지속 부하

목적:
- OMS와 PII 전체 파이프라인의 지속 처리 한계 확인

방법:
- `POST /sample-order` 요청
- 생성된 ID 기준으로 `GET /sample-order/:id` 또는 DB 조회로 완료 여부 확인
- `pii_id`가 채워질 때까지 종단시간 측정

권장 단계:
- 3 RPS, 5 RPS, 8 RPS, 10 RPS, 12 RPS, 15 RPS

핵심 관찰:
- `INIT` / `REQUESTED` backlog 누적 여부
- PII consume 처리량과 응답 처리량 균형

### 7.3 시나리오 C: Burst

목적:
- 순간 유입 급증 시 적체와 회복성 확인

방법:
- 평시 0 또는 저부하 상태에서
- 목표 RPS의 2배 수준까지 30초 내 급증
- 3~5분 유지 후 종료

핵심 관찰:
- Redis pending 증가
- outbox 상태 적체
- 테스트 종료 후 drain 시간

### 7.4 시나리오 D: Duplicate / Race

목적:
- 동일 `orderNo` 동시 요청 시 중복 방지 검증

방법:
- 전체 트래픽 중 10~20%는 동일 `orderNo`를 짧은 간격으로 중복 전송
- 일부는 정확히 같은 body
- 일부는 동일 `orderNo`로 거의 동시 발송

기대 결과:
- 신규 `sample_orders` row는 1건이어야 함
- 중복 요청은 기존 주문 반환 또는 unique race 흡수
- `pii_outbox`도 중복 생성되지 않아야 함

### 7.5 시나리오 E: 장애 / 회복

목적:
- 비동기 파이프라인 장애 시 backlog 및 복구 능력 확인

방법 예시:
- PII consumer 일시 중단
- OMS scheduler pod 일시 중단
- 재기동 후 backlog drain 관찰

핵심 관찰:
- `RETRY_PENDING`, `FAILED`, `DLQ` 전이 비율
- 회복 후 종단 완료시간 정상 복귀 여부

---

## 8. 권장 실행 순서

1. 단건 기능 검증
2. 저부하 API 기준선
3. E2E 지속 부하
4. Burst
5. Duplicate / Race
6. 장애 / 회복

이 순서를 권장하는 이유는, 기능 이상이나 설정 병목이 있는 상태에서 곧바로 고부하를 걸면 병목 위치를 분리하기 어렵기 때문이다.

---

## 9. 관측 체크리스트

### 9.1 실행 전

- OMS scheduler 활성 여부 확인
- PII stream consumer 활성 여부 확인
- Redis Streams consumer group 존재 확인
- 테스트용 DB/Redis 정리 여부 확인
- pod replica 수 기록
- 환경변수 기록
  - `PMGO_OMS_PII_OUTBOX_PUBLISH_BATCH_SIZE`
  - `PMGO_OMS_PII_OUTBOX_MAX_RETRIES`
  - `PMGO_OMS_EXECUTES_SCHEDULER`

### 9.2 실행 중

- HTTP p95 / p99
- OMS CPU / memory
- PII CPU / memory
- DB connection usage
- Redis CPU / memory / stream lag
- `pii_outbox` 상태별 추이

### 9.3 실행 후

- 미완료 건 존재 여부
- `FAILED`, `DLQ` 잔존 여부
- backlog drain 완료 시각
- 테스트 중 생성된 총 주문 수와 최종 완료 수 일치 여부

---

## 10. 검증 쿼리 예시

```sql
-- sample_orders 전체 현황
SELECT sample_order_id, order_no, pii_id, pii_outbox_id, source_tag, created_at, updated_at
FROM sample_orders
ORDER BY sample_order_id DESC;
```

```sql
-- pii_outbox 상태별 개수
SELECT status, COUNT(*) AS cnt
FROM pii_outbox
GROUP BY status
ORDER BY status;
```

```sql
-- 아직 완료되지 않은 건
SELECT id, idempotency_key, status, request_count, last_error, next_retry_at, created_at, updated_at
FROM pii_outbox
WHERE status IN ('INIT', 'REQUESTED', 'RETRY_PENDING', 'FAILED', 'DLQ')
ORDER BY id DESC;
```

```sql
-- 주문 생성 후 최종 PII 반영까지 아직 안 끝난 건
SELECT so.sample_order_id, so.order_no, so.pii_id, po.status, po.request_count, po.last_error
FROM sample_orders so
LEFT JOIN pii_outbox po ON po.id = so.pii_outbox_id
WHERE so.pii_id IS NULL
ORDER BY so.sample_order_id DESC;
```

```sql
-- orderNo 중복 여부 확인
SELECT order_no, COUNT(*) AS cnt
FROM sample_orders
GROUP BY order_no
HAVING COUNT(*) > 1;
```

---

## 11. 리스크 및 해석 주의점

- HTTP latency만 보면 실제 병목을 놓칠 수 있다.
- 종단 완료시간은 cron 주기와 batch size 영향을 직접 받는다.
- scheduler replica 수가 다르면 결과가 크게 달라질 수 있다.
- PII가 재사용 경로(`reused=true`)로 많이 빠지면 순수 생성 성능과 다른 결과가 나올 수 있다.
- duplicate 시나리오와 해피패스 시나리오는 반드시 분리해서 해석해야 한다.

---

## 12. 결론

이번 부하테스트의 핵심 성공조건은 아래와 같다.

- `POST /sample-order`가 안정적으로 수용되는가
- 비동기 구간에서 backlog가 무한정 누적되지 않는가
- 최종적으로 `sample_orders.pii_id`가 안정적으로 반영되는가
- 장애 후 backlog를 실용적인 시간 안에 회복할 수 있는가

실행 초안과 `k6` 기준 예시는 다음 문서에서 다룬다.

- `docs/load-test/20260310_sample_order_load_test_draft.md`
