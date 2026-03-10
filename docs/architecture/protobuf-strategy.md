# Protobuf 전략

## 배경

설계 문서에서는 payload 직렬화를 JSON에서 Protobuf로 확장하는 방향을 제시합니다.

- Envelope metadata: 문자열/JSON 친화 포맷 유지
- Payload: Protobuf binary 직렬화

목표는 다음과 같습니다.

- 타입 안정성 강화
- payload 크기 절감
- 향후 gRPC 전환 시 스키마 자산 재사용

## 현재 구현 상태

현재 `RedisStreamsPublisher`/`RedisStreamsConsumer`는 다음 구조로 동작합니다.

```text
XADD <streamKey> * envelope "<EventEnvelope JSON>"
```

즉, Redis stream field는 `envelope` 단일 필드이며 JSON 파싱 기반입니다.

## 단계적 도입 전략 (권장)

1. `.proto` 정의 및 코드 생성 체계(Buf + ts-proto) 도입
2. 서비스 payload를 Protobuf로 encode/decode
3. 단기 호환 단계: payload를 base64 문자열로 envelope payload에 저장
4. 장기 목표: adapter 확장으로 `payload_bin` 분리 필드 지원

## 단기 호환 패턴 (현재 코드로 가능)

현재 adapter를 유지하면서 payload를 Protobuf bytes로 운반하려면, payload를 base64 문자열로 감싸는 방식이 안전합니다.

```ts
interface ProtoPayloadEnvelope {
  codec: 'protobuf'
  messageType: 'order.v1.OrderCreated'
  payloadBase64: string
}
```

이 객체를 `EventEnvelope.payload`에 넣으면 JSON 직렬화/역직렬화와 호환됩니다.

## 장기 목표 패턴 (설계 방향)

향후 adapter 확장 시 Redis field를 분리할 수 있습니다.

```text
eventId, type, occurredAt, source, schemaVersion, headers_json, payload_bin
```

장점:

- Redis CLI에서 metadata 확인 용이
- payload는 binary 그대로 보관 가능
- 대용량/고빈도 이벤트에서 효율 개선

## Protobuf 도입 체크리스트

- [ ] 이벤트별 `.proto` 스키마 작성
- [ ] schemaVersion 정책 수립(필드 추가/삭제 규칙)
- [ ] producer/consumer 동시 배포 순서 정의
- [ ] decode 실패 시 정책(`ack`/`skip`) 재점검
- [ ] 스키마 브레이킹 체커(Buf breaking) CI 포함
