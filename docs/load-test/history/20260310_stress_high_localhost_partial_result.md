# sample_order stress_high 부분 실행 기록

작성일: 2026-03-10
환경:
- 대상 URL: `http://localhost:3000`
- 스크립트: `docs/load-test/k6/sample_order_load_test.js`
- 프로파일: `stress_high`
- 상태: 사용자 수동 중단으로 부분 실행
- 참고: 당시 스크립트는 PII 필드가 고정이어서 `pii` 테이블 row 수에는 재사용 영향이 포함될 수 있음

실행 명령:

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=stress_high \
  -e POLL_SAMPLE_RATE=0.1 \
  -e SUMMARY_JSON=docs/load-test/results/stress_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

---

## 1. 시나리오

`stress_high`는 아래 단계를 목표로 설계되었다.

- 12 RPS 3분
- 25 RPS 5분
- 50 RPS 5분
- 100 RPS 5분
- 150 RPS 5분
- ramp down 3분

계획 총 시간:
- 약 26분

이번 실행은 중간에 `E2E_TIMEOUT` 로그가 다수 발생해 사용자가 수동 중단했다.

---

## 2. 결과 요약

사용자 제공 요약 기준:

- create success rate: `96.03%`
- create p95: `670.30 ms`
- create p99: `2572.95 ms`
- e2e success rate: `9.28%`
- e2e p95: `37690.15 ms`
- e2e p99: `43479.22 ms`
- iterations: `75360 complete`
- interrupted iterations: `600`

로그 특이사항:

- `E2E_TIMEOUT` 다수 발생
- `timeoutMs=45000`
- 사용자가 에러 로그 증가를 보고 직접 종료

추가 관찰:

- 테스트 말미 `sample_orders.pii_id IS NULL` 개수가 `51,000+`까지 증가
- 아래 쿼리로 확인

```sql
select count(*)
from sample_orders so
where so.pii_id is null;
```

- 테스트 종료 후 카운트가 점진적으로 감소
- 사용자는 `5초마다 한 번씩` 재시도/재발행 흐름을 거치며 backlog가 소진되는 것으로 관찰

---

## 3. 해석

이 결과는 `stress_high` 구간에서 시스템이 명확히 열화되었음을 의미한다.

### 3.1 Create 경로

- `create success rate`가 `100%`가 아니다.
- `create p95 670ms`, `p99 2572ms`는 create API도 이미 영향을 받기 시작했다는 의미다.

즉, 이 구간에서는 비동기 구간뿐 아니라 API 응답 경로도 완전히 안전하지 않다.

### 3.2 E2E 경로

- `e2e success rate 9.28%`는 polling 표본 중 대부분이 `45초` 내 완료되지 못했다는 뜻이다.
- 이는 OMS -> PII -> OMS 비동기 처리량이 유입량을 따라가지 못하고 있다는 신호다.

즉, 이 테스트에서는 E2E 기준으로 사실상 포화 상태에 가까웠다.

다만 이번 테스트에서 확인된 추가 사실이 있다.

- `sample_orders.pii_id IS NULL` backlog가 `51,000+`까지 치솟은 뒤
- 테스트 종료 후 점차 감소했다.

즉, 상당수 timeout 건은 즉시 영구 실패라기보다 "정해둔 `45초` 안에 완료되지 못한 지연 건"으로 보는 것이 더 정확하다.
이 점은 매우 중요하다.

- SLA 관점에서는 실패로 간주해야 한다.
- 하지만 시스템 동작 관점에서는 비동기 구간이 밀린 뒤, 테스트 종료 후 backlog를 뒤늦게 소진하고 있는 상태다.

이 해석은 현재 병목이 HTTP create보다는 비동기 처리량 부족에 더 가깝다는 가설과 일치한다.

### 3.3 Interrupted iterations 해석

- `600 interrupted iterations`는 시스템 실패로 바로 해석하면 안 된다.
- 이번 실행은 사용자가 직접 종료했으므로, 이 수치는 사용자 중단 영향이 포함된 값이다.

하지만 이 점을 감안해도 아래는 여전히 유효하다.

- `E2E_TIMEOUT`이 대량 발생했다.
- `e2e success rate`가 극단적으로 낮다.
- `create success rate`도 떨어졌다.

따라서 `stress_high`는 현재 환경에서 안정 운영 가능한 구간을 넘어선 것으로 보는 것이 타당하다.

---

## 4. 결론

이번 실행은 완주하지는 못했지만, 실무적으로는 다음 결론을 내릴 수 있다.

- `stress_high`는 현재 로컬 환경 또는 현재 서비스 설정 기준으로 과부하 구간이다.
- 특히 비동기 완료 구간이 가장 먼저 무너진다.
- `E2E_TIMEOUT` 중 상당수는 영구 실패보다 backlog 지연 성격일 가능성이 높다.
- 테스트 종료 후 `pii_id IS NULL` backlog가 줄어든 점은, 현재 시스템이 "처리 불능"이라기보다 "유입량 대비 처리량 부족" 상태였음을 시사한다.
- 강한 테스트를 계속 반복하기보다, 먼저 안전 구간과 열화 시작 지점을 더 낮은 프로파일로 좁혀야 한다.

---

## 5. 다음 권장 순서

### 5.1 `million_day`

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=million_day \
  -e POLL_SAMPLE_RATE=0.2 \
  -e SUMMARY_JSON=docs/load-test/results/million_day_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

목적:
- 하루 `100만건/일` 평균 부하를 상회하는 현실적인 구간에서 안정성 확인

### 5.2 `peak`

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=peak \
  -e POLL_SAMPLE_RATE=0.1 \
  -e SUMMARY_JSON=docs/load-test/results/peak_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

목적:
- 평균보다 높은 피크 구간에서 completion 열화 시작점 확인

### 5.3 `stress_high` 재실행

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=stress_high \
  -e POLL_SAMPLE_RATE=0.05 \
  -e SUMMARY_JSON=docs/load-test/results/stress_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

목적:
- 관측 부하를 조금 줄인 상태에서 실제 붕괴 지점과 timeout 분포를 더 명확히 확인

### 5.4 `spike_high`

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=spike_high \
  -e POLL_SAMPLE_RATE=0.05 \
  -e SUMMARY_JSON=docs/load-test/results/spike_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

목적:
- 순간 급증 시 backlog와 회복 시간 확인

---

## 6. 강한 테스트에서 반드시 같이 볼 것

- `pii_outbox` 상태별 개수
- `sample_orders.pii_id IS NULL` 증가 추이
- Redis Stream pending / lag
- 테스트 종료 후 drain 완료 시간
- `FAILED`, `RETRY_PENDING`, `DLQ` 증가 여부

특히 이번 테스트 이후에는 아래 관찰을 반복적으로 기록하는 것이 중요하다.

```sql
select count(*)
from sample_orders so
where so.pii_id is null;
```

기록 포인트:
- 최고 backlog 값
- 테스트 종료 시 backlog 값
- 5분 후 backlog 값
- 10분 후 backlog 값
- 완전 drain까지 걸린 시간
