import type { EventEnvelope, EventPublisherPort } from '@shhan-ops/event-messaging'

export class OrderPublisherService {
  constructor(private readonly publisher: EventPublisherPort) {}

  async publishOrderCreated(orderId: number, partnerId: number): Promise<void> {
    const envelope: EventEnvelope<{ orderId: number; partnerId: number }> = {
      eventId: crypto.randomUUID(),
      type: 'order.created.v1',
      occurredAt: new Date().toISOString(),
      source: 'oms-order-service',
      schemaVersion: 1,
      payload: { orderId, partnerId },
      headers: {
        traceId: 'trace-example',
        correlationId: `order-${orderId}`,
      },
    }

    await this.publisher.publish(envelope)
  }
}
