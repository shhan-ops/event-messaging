# sample_order API 부하테스트 실행 초안

작성일: 2026-03-10
기준 문서:
- `docs/load-test/20260310_sample_order_load_test_design.md`

---

## 1. 목적

이 문서는 `sample_order` 부하테스트를 빠르게 시작하기 위한 실행 초안이다.
도구는 `k6`를 기준으로 작성한다.

실제 스크립트:
- `docs/load-test/k6/sample_order_load_test.js`

구조:
- `sample_order_load_test.js`: scenario entrypoint
- `sample_order_config.js`: env / runtime config
- `sample_order_profiles.js`: profile / scenario / threshold 정의
- `sample_order_metrics.js`: 커스텀 metric 정의
- `sample_order_helpers.js`: payload / polling / summary helper

초안 범위:
- 부하 시나리오 템플릿
- 요청 payload 초안
- 종단 확인 방식
- 실행 체크리스트

---

## 2. 테스트 대상 API

### 2.1 생성 API

```http
POST /sample-order
Content-Type: application/json
```

예시 body:

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

### 2.2 상태 확인 API

```http
GET /sample-order/:id
```

확인 포인트:
- `piiId`
- `outboxStatus.status`
- `outboxStatus.requestCount`
- `outboxStatus.lastError`

---

## 3. 데이터 생성 규칙 초안

### 3.1 해피패스

- `orderNo = LT-{yyyyMMddHHmmss}-{vu}-{iter}`
- 기본값은 `PII_DATA_MODE=unique`
- 즉 `orderNo`별로 이름/전화번호/주소도 함께 바뀌도록 되어 있다.

예시:

```text
LT-20260310173000-12-184
```

### 3.2 중복 시나리오

- 전체 요청의 10~20%는 `orderNo`를 재사용
- 재사용 규칙 예시
  - 5회마다 1회는 직전 요청의 `orderNo`를 재사용
  - 특정 VU 그룹은 같은 prefix로 의도적으로 충돌
- 현재 스크립트는 `orderNo`를 기준으로 PII 필드를 결정하므로, 같은 `orderNo`를 재사용하면 같은 PII 값도 재사용된다.

### 3.3 PII 데이터 모드

스크립트는 `PII_DATA_MODE`로 PII payload 생성 방식을 바꿀 수 있다.

- `unique`
  - 기본값
  - `orderNo` 기준으로 이름/전화번호/주소가 함께 바뀜
  - 실제 PII row 생성량과 비동기 처리량을 보고 싶을 때 사용
- `fixed`
  - 모든 요청이 같은 이름/전화번호/주소를 사용
  - PII 재사용 비율이 높아져 create API와 OMS backlog만 보고 싶을 때 사용

PII 생성량을 확인하고 싶으면 `unique`를 사용한다.
기존 `stress_high` 일부 결과는 PII 필드가 고정이던 시점에 실행되었으므로, `pii` 테이블 row 수는 재사용 영향이 섞였을 수 있다.

---

## 4. 시나리오 초안

현재는 아래 초안을 실제 `PROFILE` 값으로 스크립트에 반영해 두었다.

- `smoke_short`
- `smoke`
- `million_day`
- `peak`
- `stress_high`
- `stress_resume_mid`
- `stress_resume_high`
- `spike_high`
- `spike_resume_high`
- `duplicate`
- `soak`

## 4.1 Scenario A: API Baseline

목표:
- OMS API 단독 수용능력 확인

초안:

```javascript
export const options = {
  scenarios: {
    api_baseline: {
      executor: 'ramping-arrival-rate',
      timeUnit: '1s',
      preAllocatedVUs: 20,
      maxVUs: 100,
      stages: [
        { target: 1, duration: '10m' },
        { target: 3, duration: '10m' },
        { target: 5, duration: '10m' },
        { target: 8, duration: '10m' },
        { target: 10, duration: '10m' }
      ]
    }
  }
}
```

관찰 항목:
- HTTP latency
- 4xx / 5xx
- `sample_orders` 증가량

## 4.2 Scenario B: E2E Sustained

목표:
- OMS -> PII -> OMS 종단 성능 확인

초안:

```javascript
export const options = {
  scenarios: {
    e2e_sustained: {
      executor: 'ramping-arrival-rate',
      timeUnit: '1s',
      preAllocatedVUs: 30,
      maxVUs: 150,
      stages: [
        { target: 3, duration: '10m' },
        { target: 5, duration: '10m' },
        { target: 8, duration: '10m' },
        { target: 10, duration: '10m' },
        { target: 12, duration: '10m' },
        { target: 15, duration: '10m' }
      ]
    }
  }
}
```

추가 처리:
- `create`와 `sampled e2e`는 별도 scenario로 분리
- `sampled e2e`는 독립된 저율의 `create + poll` 검증 흐름으로 해석
- 시나리오 간 실시간 state 공유는 하지 않으므로, 동일 실행 내에서 `create` 결과를 그대로 poll하는 구조는 아님
- 동일 샘플을 정확히 이어받아 poll하려면 Redis/DB/API 같은 외부 shared store가 필요

관찰 항목:
- HTTP success rate
- E2E completion time
- `INIT`, `REQUESTED`, `RETRY_PENDING` backlog

## 4.3 Scenario C: Burst

목표:
- 순간 트래픽 급증 시 복원력 확인

초안:

```javascript
export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-arrival-rate',
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 300,
      stages: [
        { target: 0, duration: '1m' },
        { target: 20, duration: '30s' },
        { target: 20, duration: '5m' },
        { target: 0, duration: '2m' }
      ]
    }
  }
}
```

관찰 항목:
- burst 직후 outbox backlog 증가량
- drain 완료까지 걸리는 시간

## 4.4 Scenario D: Duplicate / Race

목표:
- 중복 요청 및 unique race 처리 확인

초안:

```javascript
// 예시 규칙
// - 80%: 고유 orderNo
// - 20%: 중복 orderNo
```

검증 항목:
- `sample_orders`에 동일 `orderNo`가 2건 이상 생기지 않는지
- duplicate 응답률
- `pii_outbox` 중복 생성 여부

## 4.5 Scenario E: Recovery

목표:
- 일부 consumer 또는 scheduler 중단 시 회복능력 확인

실행 초안:

1. 저부하 또는 중부하로 5~10분 운영
2. PII consumer 또는 OMS scheduler를 3~5분 중지
3. backlog 증가 확인
4. 재기동 후 drain 시간 측정

검증 항목:
- `FAILED`, `DLQ` 증가 여부
- backlog 회복 시간

---

## 5. k6 스크립트 구조 초안

```javascript
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE_URL = __ENV.BASE_URL

function buildOrderNo() {
  const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `LT-${ts}-${__VU}-${__ITER}`
}

function buildPayload(orderNo) {
  return JSON.stringify({
    orderNo,
    recipientName: 'Load Test User',
    recipientPhonePrimary: '01012345678',
    recipientCountry: 'KR',
    recipientFullAddress: '서울시 강남구 테헤란로 123',
    recipientPostalCode: '06236',
    deliveryMessage: 'load-test'
  })
}

export default function () {
  const orderNo = buildOrderNo()
  const res = http.post(`${BASE_URL}/sample-order`, buildPayload(orderNo), {
    headers: { 'Content-Type': 'application/json' }
  })

  check(res, {
    'create status is 200': (r) => r.status === 200
  })

  sleep(1)
}
```

주의:
- 실제 반환 body 구조를 먼저 확인해 `sampleOrderId` 추출 로직을 맞춰야 한다.
- 종단시간 측정을 위해서는 생성 응답의 ID를 추적하거나, `orderNo`로 후속 조회할 수 있어야 한다.

---

## 5.1 실행 명령 예시

### smoke

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=smoke \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=1 \
  docs/load-test/k6/sample_order_load_test.js
```

### 100만건/일 가정 기본 프로파일

평균 약 `11.57 RPS`를 기준으로 `12 -> 25 -> 50 -> 75 RPS`까지 올린다.

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=million_day \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=1 \
  -e SUMMARY_JSON=docs/load-test/results/million_day_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

### 피크 부하

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=peak \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=1 \
  docs/load-test/k6/sample_order_load_test.js
```

### 더 강한 단계형 부하

`12 -> 25 -> 50 -> 100 -> 150 RPS`까지 순차 상승한다.

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=stress_high \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=2 \
  -e SUMMARY_JSON=docs/load-test/results/stress_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

의도:
- 하루 `100만건/일`은 평균 약 `11.57 RPS`이므로, 그보다 높은 실제 피크 구간을 가정해 시스템 한계를 확인한다.
- 평균 부하가 아니라 "언제부터 밀리기 시작하는지"를 보는 테스트다.

이 명령으로 보고 싶은 것:
- `POST /sample-order`가 몇 RPS까지 안정적으로 수용되는지
- `create p95/p99`가 언제부터 증가하는지
- `E2E completion`이 언제부터 급격히 느려지는지
- OMS -> PII -> OMS 비동기 구간에 backlog가 쌓이기 시작하는지
- 테스트 종료 후 backlog가 얼마나 빨리 drain 되는지

결과 해석 기준:
- `create`는 빠른데 `E2E`만 나빠지면
  - HTTP/API 자체보다 outbox publish, Redis Streams, PII consumer, 결과 반영 구간이 병목일 가능성이 높다.
- `create p95/p99`까지 같이 나빠지면
  - OMS API 또는 DB write path가 병목일 가능성이 높다.
- `E2E success rate`가 떨어지거나 timeout이 생기면
  - 현재 유입량이 비동기 처리량을 초과한 것이다.
- 테스트 종료 후에도 `pii_id IS NULL`, `REQUESTED`, `RETRY_PENDING`이 오래 남으면
  - 현재 설정으로는 해당 피크를 지속 처리하기 어렵다는 의미다.

### 중간 고부하부터 재시작

이전 테스트에서 이미 저부하 구간은 충분히 확인됐고, `50 RPS` 이상부터 다시 보고 싶을 때 사용한다.

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=stress_resume_mid \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=2 \
  -e SUMMARY_JSON=docs/load-test/results/stress_resume_mid_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

구간:
- 50 RPS 3분
- 100 RPS 5분
- 150 RPS 5분
- ramp down 3분

용도:
- `stress_high`를 처음부터 다시 돌리지 않고, 열화가 시작된 고부하 영역만 재검증

### 높은 구간만 재시작

`100 -> 150 RPS`만 다시 보고 싶을 때 사용한다.

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=stress_resume_high \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=2 \
  -e SUMMARY_JSON=docs/load-test/results/stress_resume_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

구간:
- 100 RPS 3분
- 150 RPS 5분
- ramp down 3분

용도:
- 사실상 장애 직전 구간만 집중 검증

### 짧고 강한 스파이크

`10 -> 50 -> 100 -> 150 RPS`를 짧게 올려 backlog와 회복 시간을 본다.

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=spike_high \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=2 \
  -e SUMMARY_JSON=docs/load-test/results/spike_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

### 스파이크 고부하부터 재시작

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=spike_resume_high \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=2 \
  -e SUMMARY_JSON=docs/load-test/results/spike_resume_high_summary.json \
  docs/load-test/k6/sample_order_load_test.js
```

구간:
- 50 RPS 1분
- 100 RPS 2분
- 150 RPS 2분
- ramp down 2분

### 중복 경합

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=duplicate \
  -e PII_DATA_MODE=unique \
  -e DUPLICATE_RATE=0.2 \
  -e E2E_RATE_PER_SEC=1 \
  docs/load-test/k6/sample_order_load_test.js
```

### 장시간 soak

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=soak \
  -e PII_DATA_MODE=unique \
  -e E2E_RATE_PER_SEC=1 \
  docs/load-test/k6/sample_order_load_test.js
```

### 인증이 필요한 환경

현재 `sample-order`는 public으로 열려 있지만, 환경에 따라 ingress 또는 gateway에서 인증이 필요하면 아래처럼 토큰을 넣는다.

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=million_day \
  -e PII_DATA_MODE=unique \
  -e AUTH_TOKEN=your-token \
  docs/load-test/k6/sample_order_load_test.js
```

PII 재사용 위주로 보고 싶으면 아래처럼 `fixed`를 쓴다.

```bash
k6 run \
  -e BASE_URL=http://localhost:3000 \
  -e PROFILE=million_day \
  -e PII_DATA_MODE=fixed \
  -e E2E_RATE_PER_SEC=1 \
  docs/load-test/k6/sample_order_load_test.js
```

---

## 6. 종단 완료 측정 초안

### 6.1 방법 A: API polling

- 생성 응답에서 `sampleOrderId` 확보
- `GET /sample-order/:id`를 1~2초 간격으로 polling
- 완료 조건
  - `piiId != null`
  - `outboxStatus.status == "COMPLETED"`

장점:
- 애플리케이션 관점 검증 가능

단점:
- polling 자체가 추가 부하가 됨

### 6.2 방법 B: DB 관측

- k6는 생성 부하만 담당
- 별도 관측 쿼리로 완료율과 지연을 계산

장점:
- API 추가 부하 없음

단점:
- 테스트 스크립트와 결과의 직접 연결성이 약함

권장:
- 초기에는 방법 B로 시작
- 필요 시 표본 샘플에 한해 방법 A를 병행

---

## 7. 사전 체크리스트

- 테스트 환경은 운영과 분리되어 있는가
- OMS scheduler가 실제로 켜져 있는가
- PII consumer가 실제로 켜져 있는가
- Redis Streams consumer group이 정상인가
- `docs/load-test/results` 디렉터리가 필요한 경우 미리 생성했는가
- 기존 테스트 데이터 정리가 끝났는가
- CPU / memory / DB connections / Redis 지표를 볼 대시보드가 준비되어 있는가
- outbox 관련 환경변수 값을 기록했는가

---

## 7.1 재실행 전 데이터 초기화 권장

로컬 또는 전용 테스트 환경에서 다시 부하테스트를 돌릴 때는 기존 테스트 데이터를 비우는 편이 낫다.

이유:
- 이전 테스트 backlog가 남아 있으면 새 테스트의 E2E timeout과 backlog를 분리해서 해석하기 어렵다.
- `sample_orders.pii_id IS NULL`가 이전 실행 잔여분인지 새 실행 영향인지 섞이게 된다.
- `pii_outbox`의 `REQUESTED`, `RETRY_PENDING`, `FAILED`, `DLQ`도 이전 테스트 흔적이 남으면 비교가 왜곡된다.

권장:
- 로컬/격리된 테스트 DB라면 `sample_orders`, `pii_outbox`를 비우고 시작
- 공유 환경이면 삭제하지 말고 별도 prefix를 써서 테스트 범위를 분리

로컬 테스트 DB 초기화 예시:

```sql
TRUNCATE TABLE sample_orders, pii_outbox RESTART IDENTITY;
```

초기화 후 확인:

```sql
SELECT COUNT(*) FROM sample_orders;
SELECT COUNT(*) FROM pii_outbox;
SELECT COUNT(*) FROM sample_orders so WHERE so.pii_id IS NULL;
```

주의:
- 이 쿼리는 테스트 전용 DB에서만 사용한다.
- 공유 개발/스테이징 환경에서는 무조건 실행하면 안 된다.

---

## 8. 실행 체크리스트

- test start time 기록
- 배포 버전 / image tag 기록
- pod replica 수 기록
- 환경변수 값 기록
- 목표 RPS 및 stage 기록
- 장애 주입 시각 기록
- test stop time 기록
- drain 완료 시각 기록

---

## 9. 결과 정리 템플릿

### 9.1 요약

- 환경:
- 버전:
- replica:
- 시나리오:
- 최대 목표 RPS:
- 총 생성 요청 수:
- 성공률:

### 9.2 API 결과

- p50:
- p95:
- p99:
- timeout:
- 4xx:
- 5xx:

### 9.3 종단 결과

- 완료율:
- p95 completion time:
- p99 completion time:
- 최대 backlog:
- drain time:

### 9.4 오류 결과

- `FAILED` 건수:
- `DLQ` 건수:
- 대표 에러 메시지:

### 9.5 해석

- 병목 구간:
- 설정 조정 필요 항목:
- 다음 실험 제안:

---

## 9.6 실행 히스토리

- `2026-03-10`: `smoke_short` 실행 완료
- 상세 보고서: `docs/load-test/history/20260310_smoke_short_localhost_result.md`
- `2026-03-10`: `stress_high` 실행 중 사용자 중단
- 상세 보고서: `docs/load-test/history/20260310_stress_high_localhost_partial_result.md`

---

## 9.7 다음 권장 순서

현재까지의 결과 기준으로 다음 순서를 권장한다.

1. `million_day`
2. `peak`
3. `stress_high` 재실행
4. `spike_high`
5. `duplicate`
6. `soak`

권장 이유:
- `smoke_short`에서는 create API는 안정적이었지만 E2E가 이미 수 초 단위였다.
- `stress_high`에서는 E2E timeout이 대량 발생했고, create success rate도 하락했다.
- 따라서 바로 더 강한 테스트를 반복하기보다, 안전 구간과 열화 시작 지점을 먼저 좁히는 것이 낫다.

각 단계의 목적:
- `million_day`
  - 평균 `100만건/일` 수준을 약간 상회하는 현실적인 기본 부하 확인
- `peak`
  - 평균보다 높은 피크 구간에서 E2E completion과 backlog 증가 시작점 확인
- `stress_high`
  - 안전 구간 파악 후 재실행하여 실제 붕괴 지점 확인
- `spike_high`
  - 순간 급증 시 회복력과 drain 시간 확인
- `duplicate`
  - 중복 주문 번호 경합과 멱등 처리 검증
- `soak`
  - 장시간 지속 부하에서 누수, backlog 누적, completion 열화 여부 확인

재실행 팁:
- `stress_high` 재실행 시에는 `E2E_RATE_PER_SEC=1` 또는 `2`를 권장한다.
- 강한 테스트는 반드시 `pii_outbox` 상태, `sample_orders.pii_id IS NULL`, Redis lag를 함께 본다.

---

## 10. 검증 SQL 초안

```sql
SELECT status, COUNT(*) AS cnt
FROM pii_outbox
GROUP BY status
ORDER BY status;
```

```sql
SELECT so.sample_order_id, so.order_no, so.pii_id, po.status, po.request_count, po.last_error
FROM sample_orders so
LEFT JOIN pii_outbox po ON po.id = so.pii_outbox_id
ORDER BY so.sample_order_id DESC
LIMIT 100;
```

```sql
SELECT order_no, COUNT(*) AS cnt
FROM sample_orders
GROUP BY order_no
HAVING COUNT(*) > 1;
```

---

## 11. 다음 단계

이 초안 문서를 기준으로 다음 작업을 이어갈 수 있다.

1. 실제 `k6` 스크립트 파일 생성
2. 시나리오별 shell 실행 명령 작성
3. DB/Redis 관측 쿼리 자동화
4. 결과 리포트 템플릿 정식화
