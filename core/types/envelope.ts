/**
 * EventEnvelope headers에서 사용하는 표준 헤더 키 상수.
 */
export const ENVELOPE_HEADER_KEYS = {
  TRACE_ID: 'traceId',
  CORRELATION_ID: 'correlationId',
  TENANT_ID: 'tenantId',
  PARTNER_ID: 'partnerId',
  DEDUP_KEY: 'dedupKey',
} as const

/**
 * 도메인 이벤트 payload를 라우팅 및 메타데이터 필드와 함께 감싸는 표준 봉투.
 *
 * @template T - payload 타입
 */
export interface EventEnvelope<T> {
  /** 이벤트 발생 식별자 (UUIDv7 권장) */
  eventId: string
  /** 이벤트 타입 식별자 (예: "order.created") */
  type: string
  /** 이벤트 발생 시각 (ISO-8601 UTC) */
  occurredAt: string
  /** 이벤트를 발행한 서비스 또는 바운디드 컨텍스트 */
  source: string
  /** payload 스키마 버전 (하위 호환성 관리용) */
  schemaVersion: number
  /** 도메인 이벤트 payload */
  payload: T
  /** 선택적 전파 헤더 (traceId, correlationId 등) */
  headers?: Record<string, string>
}
