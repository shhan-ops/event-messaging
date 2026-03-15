# sample_order smoke_short 실행 기록

작성일: 2026-03-10
환경:
- 대상 URL: `http://localhost:3000`
- 스크립트: `docs/load-test/k6/sample_order_load_test.js`
- 프로파일: `smoke_short`
- summary json: `docs/load-test/results/smoke_short_summary.json`

실행 명령:

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=smoke_short \
  -e POLL_SAMPLE_RATE=0.3 \
  -e SUMMARY_JSON=docs/load-test/results/smoke_short_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

---

## 1. 시나리오

`smoke_short`는 약 90초 동안 아래 단계로 실행되었다.

- 30초: 1 RPS
- 45초: 3 RPS
- 15초: ramp down

최대 설정:
- max VUs: 400
- 실제 VU max: 10

---

## 2. 결과 요약

### 2.1 Create API

- create success rate: `100.00%`
- create p95: `35.57 ms`
- create p99: `113.18 ms`
- create avg: `25.07 ms`
- 총 iterations: `127`

### 2.2 E2E

- e2e success rate: `100.00%`
- completed polls: `41`
- e2e avg: `5255.37 ms`
- e2e p95: `9102.00 ms`
- e2e p99: `9155.40 ms`
- e2e min: `1040 ms`
- e2e max: `9187 ms`

### 2.3 HTTP

- 총 HTTP requests: `380`
- http_req_failed: `0`
- checks: `100%`

---

## 3. 해석

이번 결과는 아래 의미를 가진다.

1. `POST /sample-order` 자체는 현재 매우 가볍다.
2. 병목은 아직 HTTP create 경로가 아니라 비동기 완료 구간일 가능성이 높다.
3. 낮은 부하에서도 E2E p95가 약 9.1초이므로, 현재 시스템은 이미 `create 응답시간`과 `최종 완료시간`이 크게 분리되어 있다.
4. 다음 테스트는 API p95보다 `pii_outbox backlog`, `REQUESTED/RETRY_PENDING 증가`, `완료시간 증가율`에 초점을 맞춰야 한다.

특히 현재 E2E 지연은 cron 기반 outbox publish, PII consume, 결과 반영 주기의 영향을 받을 가능성이 높다.

---

## 4. 결론

짧은 smoke 기준에서는 다음이 확인되었다.

- 기능적으로는 부하테스트 진행 가능
- 낮은 수준의 create API 부하는 충분히 안정적
- 다음 단계는 `million_day` 또는 `stress_high` 프로파일로 backlog 민감도를 확인하는 것

---

## 5. 다음 권장 실행

### 5.1 100만건/일 가정 기본 부하

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=million_day \
  -e POLL_SAMPLE_RATE=0.2 \
  -e SUMMARY_JSON=docs/load-test/results/million_day_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

목적:
- 평균 `11.57 RPS`를 넘는 구간에서 E2E 완료시간과 backlog가 어떻게 증가하는지 확인

### 5.2 더 강한 단계형 부하

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=stress_high \
  -e POLL_SAMPLE_RATE=0.1 \
  -e SUMMARY_JSON=docs/load-test/results/stress_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

목적:
- `12 -> 25 -> 50 -> 100 -> 150 RPS`에서 HTTP 성공률과 E2E 열화 지점 확인

### 5.3 짧고 강한 스파이크

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=spike_high \
  -e POLL_SAMPLE_RATE=0.05 \
  -e SUMMARY_JSON=docs/load-test/results/spike_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

목적:
- 순간 고부하에서 적체 및 회복 시간 확인

---

## 6. 후속 확인 항목

강한 테스트부터는 아래를 같이 봐야 한다.

- `pii_outbox` 상태별 건수
- `sample_orders.pii_id IS NULL` 증가 추이
- Redis Stream pending / lag
- 테스트 종료 후 drain 완료 시간
