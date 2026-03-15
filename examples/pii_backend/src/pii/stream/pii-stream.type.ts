export const PII_STREAM_EVENT_TYPE = {
  CREATE_REQUESTED: 'pii.create.requested.v1',
  CREATED: 'pii.created.v1',
  FAILED: 'pii.failed.v1',
} as const

export const PII_STREAM_PUBLISHER = 'PII_STREAM_PUBLISHER'

export interface OmsEncryptedFields {
  name: string
  primary_phone: string
  country: string
  full_address: string
  postal_code: string
  delivery_message?: string
}

export interface OmsPiiCreateRequested {
  idempotency_key: string
  payload: {
    encrypted_fields: OmsEncryptedFields
    encryption_method: string
  }
  metadata: {
    request_context?: string
    source_table?: string
    source_id?: string | number
    order_no?: string
    source_service_type?: string
    trace_id?: string
  }
}

export interface PiiCreatedEvent {
  pii_id: string
  idempotency_key: string
  created: boolean
  reused: boolean
  trace_id?: string
}

export interface PiiFailedEvent {
  idempotency_key: string
  error: string
  error_code: string
  retryable: boolean
  attempt_count: number
  trace_id?: string
}

export class NonRetryableStreamError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
  ) {
    super(message)
  }
}
