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
import { PiiStreamService } from './pii-stream.service'
import { OmsPiiCreateRequested } from './pii-stream.type'

@Injectable()
export class PiiStreamConsumer implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PiiStreamConsumer.name)
  private runner: RedisStreamsConsumerRunner | null = null

  constructor(
    private readonly redisService: RedisService,
    private readonly piiStreamService: PiiStreamService,
  ) {}

  async onModuleInit(): Promise<void> {
    const redis = this.redisService.getClient()
    const manager = new RedisStreamsConsumerGroupManager(redis as unknown as RedisLike)
    await manager.ensureGroup(AppConfig.streams.request, AppConfig.streams.requestGroup)

    const subscriber = new RedisStreamsSubscriber(redis as unknown as RedisLike)
    this.runner = new RedisStreamsConsumerRunner(
      subscriber,
      {
        name: 'pii-request-consumer',
        group: AppConfig.streams.requestGroup,
        consumer: AppConfig.streams.requestConsumer,
        streams: [AppConfig.streams.request],
      },
      {
        onMessage: async (message: StreamMessage) => {
          const payload = this.extractPayload(message)
          await this.piiStreamService.process(payload)
        },
      },
    )

    this.runner.start()
    this.logger.log('pii stream consumer started')
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.runner) {
      await this.runner.stop()
      this.runner = null
    }
  }

  private extractPayload(message: StreamMessage): OmsPiiCreateRequested {
    const envelopeIndex = message.fields.indexOf('envelope')
    if (envelopeIndex === -1 || envelopeIndex + 1 >= message.fields.length) {
      throw new Error(`missing envelope field: ${message.messageId}`)
    }

    const envelope = JSON.parse(message.fields[envelopeIndex + 1]) as EventEnvelope<OmsPiiCreateRequested>
    return envelope.payload
  }
}
