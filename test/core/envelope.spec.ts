import { ENVELOPE_HEADER_KEYS } from '../../core/types/envelope'
import type { EventEnvelope } from '../../core/types/envelope'

describe('ENVELOPE_HEADER_KEYS', () => {
  it('모든 키가 camelCase 문자열을 가진다', () => {
    expect(ENVELOPE_HEADER_KEYS.TRACE_ID).toBe('traceId')
    expect(ENVELOPE_HEADER_KEYS.CORRELATION_ID).toBe('correlationId')
    expect(ENVELOPE_HEADER_KEYS.TENANT_ID).toBe('tenantId')
    expect(ENVELOPE_HEADER_KEYS.PARTNER_ID).toBe('partnerId')
    expect(ENVELOPE_HEADER_KEYS.DEDUP_KEY).toBe('dedupKey')
  })

  it('5개의 표준 헤더 키를 정의한다', () => {
    expect(Object.keys(ENVELOPE_HEADER_KEYS)).toHaveLength(5)
  })
})

describe('EventEnvelope', () => {
  it('headers 없이 유효한 봉투를 생성할 수 있다', () => {
    const envelope: EventEnvelope<{ orderId: string }> = {
      eventId: 'evt-001',
      type: 'order.created',
      occurredAt: '2024-01-01T00:00:00.000Z',
      source: 'order-service',
      schemaVersion: 1,
      payload: { orderId: 'ord-001' },
    }

    expect(envelope.headers).toBeUndefined()
    expect(envelope.payload.orderId).toBe('ord-001')
  })

  it('ENVELOPE_HEADER_KEYS 상수를 헤더 키로 사용할 수 있다', () => {
    const envelope: EventEnvelope<unknown> = {
      eventId: 'evt-002',
      type: 'order.shipped',
      occurredAt: '2024-01-02T00:00:00.000Z',
      source: 'order-service',
      schemaVersion: 1,
      payload: null,
      headers: {
        [ENVELOPE_HEADER_KEYS.TRACE_ID]: 'trace-abc',
        [ENVELOPE_HEADER_KEYS.CORRELATION_ID]: 'corr-xyz',
      },
    }

    expect(envelope.headers?.['traceId']).toBe('trace-abc')
    expect(envelope.headers?.['correlationId']).toBe('corr-xyz')
  })

  it('JSON 직렬화 후 역직렬화해도 동일한 봉투가 복원된다', () => {
    const original: EventEnvelope<{ value: number }> = {
      eventId: 'evt-003',
      type: 'payment.completed',
      occurredAt: '2024-06-01T12:00:00.000Z',
      source: 'payment-service',
      schemaVersion: 2,
      payload: { value: 9900 },
      headers: { [ENVELOPE_HEADER_KEYS.TENANT_ID]: 'tenant-1' },
    }

    const restored = JSON.parse(JSON.stringify(original)) as EventEnvelope<{ value: number }>

    expect(restored).toEqual(original)
    expect(restored.headers?.[ENVELOPE_HEADER_KEYS.TENANT_ID]).toBe('tenant-1')
  })
})
