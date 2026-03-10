import type { Message } from '@shhan-ops/event-messaging'

interface InboxRepository {
  exists(eventId: string): Promise<boolean>
  save(eventId: string): Promise<void>
}

export class OrderCreatedHandler {
  constructor(private readonly inbox: InboxRepository) {}

  async handle(message: Message<{ orderId: number; partnerId: number }>): Promise<void> {
    const { eventId, payload } = message.envelope

    if (await this.inbox.exists(eventId)) {
      return
    }

    await runInTransaction(async () => {
      await maskOrderPii(payload.orderId, payload.partnerId)
      await this.inbox.save(eventId)
    })
  }
}

async function runInTransaction(work: () => Promise<void>): Promise<void> {
  await work()
}

async function maskOrderPii(orderId: number, partnerId: number): Promise<void> {
  void orderId
  void partnerId
}
