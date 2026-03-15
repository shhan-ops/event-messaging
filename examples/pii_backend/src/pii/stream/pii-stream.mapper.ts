import { NonRetryableStreamError, OmsPiiCreateRequested } from './pii-stream.type'

function decodeBase64(value: string, fieldName: string): string {
  try {
    return Buffer.from(value, 'base64').toString('utf8')
  } catch {
    throw new NonRetryableStreamError(`invalid base64 field: ${fieldName}`, 'INVALID_ENCRYPTED_FIELD')
  }
}

export function parseCreateRequested(raw: string | OmsPiiCreateRequested): OmsPiiCreateRequested {
  const parsed =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw)
          } catch {
            throw new NonRetryableStreamError('invalid json payload', 'INVALID_JSON')
          }
        })()
      : raw

  if (!parsed || typeof parsed !== 'object') {
    throw new NonRetryableStreamError('payload must be object', 'INVALID_PAYLOAD')
  }

  const request = parsed as OmsPiiCreateRequested
  if (!request.idempotency_key || !request.payload?.encrypted_fields) {
    throw new NonRetryableStreamError('missing required fields', 'INVALID_PAYLOAD')
  }

  return request
}

export function mapToPiiRequest(request: OmsPiiCreateRequested) {
  if (request.payload.encryption_method !== 'MOCK-BASE64') {
    throw new NonRetryableStreamError(
      `unsupported encryption method: ${request.payload.encryption_method}`,
      'UNSUPPORTED_ENCRYPTION_METHOD',
    )
  }

  const encrypted = request.payload.encrypted_fields

  return {
    source: request.metadata?.source_service_type || 'OMS',
    traceId: request.metadata?.trace_id,
    payload: {
      name: decodeBase64(encrypted.name, 'name'),
      primaryPhone: decodeBase64(encrypted.primary_phone, 'primary_phone'),
      country: decodeBase64(encrypted.country, 'country'),
      fullAddress: decodeBase64(encrypted.full_address, 'full_address'),
      postalCode: decodeBase64(encrypted.postal_code, 'postal_code'),
      deliveryMessage: encrypted.delivery_message
        ? decodeBase64(encrypted.delivery_message, 'delivery_message')
        : '',
    },
  }
}
