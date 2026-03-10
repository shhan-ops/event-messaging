import Redis from 'ioredis'
import { RedisStreamsConsumer, RedisStreamsPublisher } from '@shhan-ops/event-messaging/adapters/redis'
import type { EventTypeRouter } from '@shhan-ops/event-messaging'

const router: EventTypeRouter = {
  resolve(eventType: string): string {
    const routingTable: Record<string, string> = {
      'order.created.v1': 'stream:orders',
      'order.cancelled.v1': 'stream:orders',
      'pii.masked.v1': 'stream:pii',
    }
    const destination = routingTable[eventType]
    if (!destination) throw new Error(`Unknown eventType: ${eventType}`)
    return destination
  },
}

const redisForPublish = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const redisForConsume = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')

export const publisher = new RedisStreamsPublisher(redisForPublish, {
  router,
  maxLenApprox: 100_000,
})

export const consumer = new RedisStreamsConsumer(redisForConsume, {
  streamKey: 'stream:orders',
  group: 'pii-masker-group',
  consumer: `pii-masker-${process.env.POD_NAME ?? 'local'}`,
  blockMs: 2000,
  count: 10,
  decodeErrorPolicy: 'ack',
})

export async function shutdown(): Promise<void> {
  await consumer.stop({ mode: 'drain', drainTimeoutMs: 30_000, onDrainTimeout: 'force' })
  redisForConsume.disconnect()
  redisForPublish.disconnect()
}
