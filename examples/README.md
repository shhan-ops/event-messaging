# examples

`event-messaging`를 실제 서비스 경계에 붙이는 샘플 모음입니다. 이 폴더는 단순 코드 조각이 아니라, `OMS -> Outbox -> Redis Stream -> PII -> Response Event` 흐름을 end-to-end로 보여주는 작은 예제 시스템입니다.

## 예제 구성

- `service-integration`
  - `event-messaging` 패키지의 최소 wiring 예제
- `oms_backend`
  - sample-order 요청 저장
  - outbox 적재
  - outbox publisher로 PII 생성 요청 발행
  - PII 결과 이벤트 소비 후 주문 상태 반영
- `pii_backend`
  - PII 생성 요청 이벤트 소비
  - PostgreSQL에 `piis` 저장 또는 재사용
  - 성공/실패 결과 이벤트 발행

## 프로젝트 설계

이 예제는 두 서비스가 서로의 데이터베이스를 직접 호출하지 않고 이벤트만으로 연결되는 구조를 보여주기 위해 분리되어 있습니다.

### 공통 설계 원칙

- PostgreSQL + Sequelize 모델/마이그레이션 사용
- NestJS 레이어드 아키텍처 유지
- service는 model을 직접 호출하지 않고 repository wrapper를 통해 접근
- 비동기 경계는 Redis Streams 이벤트로 분리
- 발행 신뢰성은 outbox 패턴으로 보완
- 소비자는 at-least-once를 전제로 멱등하게 구현

### `oms_backend` 설계

`oms_backend`는 외부 요청의 진입점입니다. `sample-order` 생성 API는 같은 트랜잭션 안에서 아래 두 작업을 수행합니다.

1. `sample_orders`에 주문 요청 저장
2. `pii_outboxes`에 PII 생성 요청 이벤트 저장

이후 별도 publisher가 `pii_outboxes`에서 발행 대기 데이터를 읽어 Redis Stream으로 내보냅니다. 이 구조를 쓰는 이유는 주문 저장 성공과 이벤트 발행 시점을 분리해서, 브로커 일시 장애가 있어도 나중에 재발행할 수 있게 하기 위해서입니다.

PII 결과 이벤트를 받으면 `oms_backend`는 outbox 상태와 주문의 `piiId`를 업데이트합니다. 즉, OMS는 "요청 기록 + 발행 책임 + 결과 반영"을 담당하고, 실제 PII 생성 책임은 가지지 않습니다.

### `pii_backend` 설계

`pii_backend`는 PII 생성 책임만 가지는 소비자 서비스입니다. 요청 이벤트를 받으면 payload를 정규화한 뒤 기존 PII를 재사용하거나 새로 생성합니다. 그 결과를 다시 이벤트로 발행해서 OMS가 후처리할 수 있게 합니다.

이 서비스는 생산자에게 동기 응답을 주지 않습니다. 메시지를 소비하고, 데이터베이스에 반영하고, 결과 이벤트를 재발행하는 비동기 worker 역할에 집중합니다.

### 전체 흐름

1. 클라이언트가 `oms_backend`에 sample-order 생성 요청
2. `oms_backend`가 주문과 outbox를 함께 저장
3. outbox publisher가 PII 요청 이벤트를 Redis Stream에 발행
4. `pii_backend`가 요청 이벤트를 소비해 PII 생성 또는 재사용
5. `pii_backend`가 성공/실패 이벤트를 다시 발행
6. `oms_backend`가 결과 이벤트를 소비해 주문과 outbox 상태 갱신

## `event-messaging` 설계 원리

`event-messaging`는 브로커 세부 구현을 애플리케이션 서비스 코드에서 분리하기 위해 설계됐습니다. 핵심 아이디어는 "서비스는 이벤트 계약만 알고, Redis Streams 같은 브로커 구현은 infra/bootstrap에서만 안다"는 것입니다.

### 1. Core 계약과 Adapter 분리

패키지는 크게 두 층으로 나뉩니다.

- core
  - `EventEnvelope`
  - publisher/consumer/subscriber port
  - stream message 타입
- adapters/redis
  - Redis Streams 기반 구현체

애플리케이션 서비스는 이벤트 envelope와 port 인터페이스를 기준으로 작성하고, 실제 구현체 선택은 bootstrap에서 결정합니다. 이 구조 덕분에 서비스 코드는 "어디에 publish하는지"보다 "어떤 이벤트를 publish하는지"에 집중할 수 있습니다.

### 2. EventEnvelope 표준화

모든 이벤트는 공통 envelope 구조를 가집니다.

- `eventId`
- `type`
- `occurredAt`
- `source`
- `schemaVersion`
- `payload`
- `headers`

이 공통 형식 덕분에 생산자와 소비자가 브로커별 포맷 차이 대신 동일한 이벤트 계약만 기준으로 동작할 수 있습니다. `headers`에는 `traceId`, `correlationId`, `dedupKey` 같은 운영 메타데이터를 담을 수 있습니다.

### 3. Destination 라우팅 추상화

publisher는 브로커의 `topic`, `stream`, `queue` 같은 구체 용어를 직접 노출하지 않습니다. 대신 `destination`이라는 중립 개념을 두고, 기본적으로 `event.type`을 라우터가 destination으로 변환합니다.

Redis adapter에서는 이 destination이 Redis stream key가 됩니다. 즉, 애플리케이션은 `order.created.v1` 같은 이벤트 타입을 만들고, infra가 이를 `stream:orders` 같은 실제 stream key로 해석합니다.

### 4. Redis Streams 기반 구현 방식

현재 Redis adapter는 다음 원리로 구현돼 있습니다.

- Publisher
  - `XADD <stream> * envelope "<json>"` 형태로 이벤트 발행
  - 필요하면 `MAXLEN ~ N`으로 대략적 trim 가능
- Consumer Group Manager
  - `XGROUP CREATE ... MKSTREAM`으로 group 보장
- Consumer
  - `XREADGROUP`으로 신규 메시지 읽기
  - handler 성공 시 `XACK`
  - handler 실패 시 ACK하지 않고 pending에 남김
- Subscriber + ConsumerRunner
  - 다중 stream polling 지원
  - `XAUTOCLAIM`으로 오래된 pending 메시지 재소유 가능

즉, 라이브러리는 Redis Streams를 직접 감싸되, 서비스 코드에는 "발행", "소비", "ACK", "재클레임" 같은 메시징 책임만 드러나도록 구성되어 있습니다.

### 5. 전달 보장과 멱등성

이 구현의 기본 전달 보장 수준은 at-least-once입니다. 따라서 동일 메시지가 재전달될 수 있다는 전제를 두고 소비자를 설계해야 합니다.

그래서 이 예제에서도 다음 원칙을 사용합니다.

- 생산자 쪽은 outbox 패턴으로 발행 누락을 줄임
- 소비자 쪽은 unique key/hash 기반으로 중복 처리를 방지
- 실패 메시지는 ACK하지 않아 재처리 가능하게 둠

이 조합이 현재 샘플에서 가장 중요한 설계 포인트입니다. `event-messaging`만으로 exactly-once를 보장하는 것이 아니라, 서비스 레벨의 outbox/멱등성 전략과 함께 사용하는 구조입니다.

### 6. 현재 구현의 범위

이 패키지는 실서비스에 바로 붙일 수 있는 최소 메시징 골격에 집중합니다. 반면 아래 항목은 아직 범위 밖이거나 서비스가 직접 운영해야 합니다.

- 공통 DLQ 프레임워크
- 전역 재시도 정책
- 브로커 중립 직렬화 프레임워크의 완성형 추상화
- Kafka 등 다른 브로커 adapter

즉, 현재 구현은 "Redis Streams 기반의 명확한 core contract + 운영 가능한 기본 consumer/publisher"를 제공하는 MVP에 가깝습니다.

## 권장 실행 순서

```bash
cd examples/pii_backend
npm install
npm run migration:up
npm run start:dev

cd ../oms_backend
npm install
npm run migration:up
npm run start:dev
```

PostgreSQL과 Redis가 먼저 떠 있어야 하며, 각 예제의 `.env`를 환경에 맞게 수정해야 합니다.
