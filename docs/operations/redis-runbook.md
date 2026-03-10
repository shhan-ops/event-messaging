# Redis 운영 Runbook

## 운영 핵심 관점

`event-messaging`의 Redis consumer는 at-least-once 모델입니다.
운영에서 가장 중요한 지표는 다음 2가지입니다.

- PEL(Pending Entries List) 크기
- Stream 길이(XLEN)

## 자주 쓰는 명령어

### 1) PEL 조회

```bash
XPENDING <streamKey> <group>
XPENDING <streamKey> <group> - + 100
```

의미:

- ACK되지 않은 메시지 수
- 오래 정체된 메시지 존재 여부

### 2) Stream 길이 조회

```bash
XLEN <streamKey>
```

의미:

- 트림 정책(maxLenApprox) 적용 상태 확인
- 소비 지연/트래픽 급증 감지

### 3) Consumer Group 상태 조회

```bash
XINFO GROUPS <streamKey>
XINFO CONSUMERS <streamKey> <group>
```

의미:

- 그룹 lag/idle 상태
- 비정상 consumer 점검

### 4) Pending 메시지 수동 reclaim

```bash
XAUTOCLAIM <streamKey> <group> <consumer> 60000 0-0 COUNT 10
```

- 60초 이상 idle 메시지를 현재 consumer로 재할당
- 현재 패키지에는 reclaim 자동 루프가 없으므로 운영 수동 대응에 활용

## 장애 시나리오별 대응

### 시나리오 A: `messaging.consume.error` 증가 + PEL 급증

가능 원인:

- 핸들러 예외 급증
- 다운스트림(DB/API) 장애

대응:

1. 최근 핸들러 에러 로그 확인 (`eventType`, `messageId`, `traceId`)
2. 다운스트림 의존성 상태 확인
3. 장애 복구 후 `XAUTOCLAIM`으로 정체 메시지 재처리

### 시나리오 B: decode 오류 증가

가능 원인:

- producer/consumer payload 포맷 불일치
- schemaVersion 호환 문제

대응:

1. 실패 메시지의 `type`, `schemaVersion` 확인
2. 최근 배포 이력에서 이벤트 스키마 변경 여부 확인
3. 필요 시 producer rollback 또는 consumer 호환 로직 추가

### 시나리오 C: graceful shutdown 누락으로 중복 처리 증가

가능 원인:

- SIGTERM에서 `stop({ mode: 'drain' })` 미호출
- 종료 유예 시간보다 handler 처리 시간이 긴 경우

대응:

1. 종료 훅에 drain stop 추가
2. `drainTimeoutMs`를 실제 처리 시간에 맞게 상향
3. handler 멱등성(Inbox/unique) 재점검

## 권장 초기 알림 기준

- `XPENDING` > 100
- 5분 이상 `XPENDING` 지속 증가
- decode error > 0
- `XLEN` 급증

## 기본 운영 파라미터 제안

- `decodeErrorPolicy`: `ack`
- `blockMs`: `2000`
- `count`: `10`
- `maxLenApprox`: `100000` (서비스별 조정)
