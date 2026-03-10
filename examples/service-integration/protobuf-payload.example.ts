import type { EventEnvelope } from '@shhan-ops/event-messaging'

interface ProtobufPayload {
  codec: 'protobuf'
  messageType: string
  payloadBase64: string
}

export function buildEnvelopeWithProtoPayload(
  type: string,
  source: string,
  payloadBytes: Uint8Array,
): EventEnvelope<ProtobufPayload> {
  return {
    eventId: crypto.randomUUID(),
    type,
    occurredAt: new Date().toISOString(),
    source,
    schemaVersion: 1,
    payload: {
      codec: 'protobuf',
      messageType: 'order.v1.OrderCreated',
      payloadBase64: Buffer.from(payloadBytes).toString('base64'),
    },
  }
}
