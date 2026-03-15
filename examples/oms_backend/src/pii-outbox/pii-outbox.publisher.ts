import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { RedisStreamsPublisher, type EventEnvelope, type EventTypeRouter, type RedisLike } from '@shhan-ops/event-messaging'
import { randomUUID } from 'crypto'
import { AppConfig } from '@/config/app.config'
import { RedisService } from '@/redis/redis.service'
import { PiiOutboxService } from './pii-outbox.service'

@Injectable()
export class PiiOutboxPublisher {
  private readonly logger = new Logger(PiiOutboxPublisher.name)
  private readonly publisher: RedisStreamsPublisher<Record<string, unknown>>

  constructor(
    private readonly piiOutboxService: PiiOutboxService,
    redisService: RedisService,
  ) {
    const router: EventTypeRouter = {
      resolve: () => AppConfig.streams.request,
    }

    this.publisher = new RedisStreamsPublisher(
      redisService.getClient() as unknown as RedisLike,
      { router },
    )
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async publishPending(): Promise<void> {
    const pending = await this.piiOutboxService.findPending(AppConfig.outbox.batchSize)

    for (const outbox of pending) {
      try {
        const payload = outbox.eventPayload as Record<string, any>
        const envelope: EventEnvelope<Record<string, unknown>> = {
          eventId: randomUUID(),
          type: 'pii.create.requested.v1',
          occurredAt: new Date().toISOString(),
          source: AppConfig.serviceName,
          schemaVersion: 1,
          payload,
          headers: {
            correlationId: outbox.idempotencyKey,
            dedupKey: outbox.idempotencyKey,
            traceId: String(payload.metadata?.trace_id || outbox.idempotencyKey),
          },
        }

        await this.publisher.publish(envelope)
        await this.piiOutboxService.markRequested(outbox.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.error(`outbox publish failed: ${message}`)
        await this.piiOutboxService.markPublishFailed(outbox.id, message, outbox.requestCount + 1)
      }
    }
  }
}
