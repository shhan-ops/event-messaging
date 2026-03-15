import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import {
  RedisStreamsPublisher,
  type EventPublisherPort,
  type EventTypeRouter,
  type RedisLike,
} from '@shhan-ops/event-messaging'
import { AppConfig } from '@/config/app.config'
import { Pii } from '@/pii/model/pii.model'
import { PiiModule } from '@/pii/pii.module'
import { RedisService } from '@/redis/redis.service'
import { PiiCreatedEvent, PiiFailedEvent, PII_STREAM_EVENT_TYPE, PII_STREAM_PUBLISHER } from './pii-stream.type'
import { PiiStreamConsumer } from './pii-stream.consumer'
import { PiiStreamService } from './pii-stream.service'

@Module({
  imports: [PiiModule, SequelizeModule.forFeature([Pii])],
  providers: [
    {
      provide: PII_STREAM_PUBLISHER,
      useFactory: (redisService: RedisService): EventPublisherPort<PiiCreatedEvent | PiiFailedEvent> => {
        const router: EventTypeRouter = {
          resolve: (eventType: string) => {
            if (eventType === PII_STREAM_EVENT_TYPE.CREATED) {
              return AppConfig.streams.created
            }
            if (eventType === PII_STREAM_EVENT_TYPE.FAILED) {
              return AppConfig.streams.failed
            }
            throw new Error(`unknown event type: ${eventType}`)
          },
        }

        return new RedisStreamsPublisher<PiiCreatedEvent | PiiFailedEvent>(
          redisService.getClient() as unknown as RedisLike,
          { router },
        )
      },
      inject: [RedisService],
    },
    PiiStreamService,
    PiiStreamConsumer,
  ],
})
export class PiiStreamModule {}
