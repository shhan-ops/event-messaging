import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common'
import {
  RedisStreamsConsumerGroupManager,
  RedisStreamsConsumerRunner,
  RedisStreamsSubscriber,
  type EventEnvelope,
  type RedisLike,
  type StreamMessage,
} from '@shhan-ops/event-messaging'
import { AppConfig } from '@/config/app.config'
import { RedisService } from '@/redis/redis.service'
import { SampleOrderService } from '@/sample-order/sample-order.service'
import { PiiOutboxService } from './pii-outbox.service'

interface PiiCreatedEvent {
  pii_id: string
  idempotency_key: string
}

interface PiiFailedEvent {
  idempotency_key: string
  error: string
  retryable: boolean
}

@Injectable()
export class PiiOutboxConsumer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PiiOutboxConsumer.name)
  private runner: RedisStreamsConsumerRunner | null = null

  constructor(
    private readonly redisService: RedisService,
    private readonly piiOutboxService: PiiOutboxService,
    private readonly sampleOrderService: SampleOrderService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redis = this.redisService.getClient()
    const manager = new RedisStreamsConsumerGroupManager(redis as unknown as RedisLike)
    await manager.ensureGroup(AppConfig.streams.created, AppConfig.streams.responseGroup)
    await manager.ensureGroup(AppConfig.streams.failed, AppConfig.streams.responseGroup)

    const subscriber = new RedisStreamsSubscriber(redis as unknown as RedisLike)
    this.runner = new RedisStreamsConsumerRunner(
      subscriber,
      {
        name: 'oms-pii-outbox-consumer',
        group: AppConfig.streams.responseGroup,
        consumer: AppConfig.streams.responseConsumer,
        streams: [AppConfig.streams.created, AppConfig.streams.failed],
      },
      {
        onMessage: async (message: StreamMessage) => {
          const payload = this.extractPayload(message)
          if (message.stream === AppConfig.streams.created) {
            const created = payload as PiiCreatedEvent
            const outbox = await this.piiOutboxService.markCompleted(created.idempotency_key, created.pii_id)
            if (outbox) {
              await this.sampleOrderService.attachPiiResult(outbox.sourceId, created.pii_id)
            }
            return
          }

          const failed = payload as PiiFailedEvent
          await this.piiOutboxService.markFailed(failed.idempotency_key, failed.error, failed.retryable)
        },
      },
    )

    this.runner.start()
    this.logger.log('oms pii outbox consumer started')
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.runner) {
      await this.runner.stop()
      this.runner = null
    }
  }

  private extractPayload(message: StreamMessage): PiiCreatedEvent | PiiFailedEvent {
    const index = message.fields.indexOf('envelope')
    if (index === -1 || index + 1 >= message.fields.length) {
      throw new Error(`missing envelope field: ${message.messageId}`)
    }

    const envelope = JSON.parse(message.fields[index + 1]) as EventEnvelope<PiiCreatedEvent | PiiFailedEvent>
    return envelope.payload
  }
}
