import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { SequelizeModule } from '@nestjs/sequelize'
import { omsDatabaseConfig } from '@/database/database.config'
import { PiiOutboxModule } from '@/pii-outbox/pii-outbox.module'
import { RedisModule } from '@/redis/redis.module'
import { SampleOrderModule } from '@/sample-order/sample-order.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    SequelizeModule.forRoot(omsDatabaseConfig),
    RedisModule,
    SampleOrderModule,
    PiiOutboxModule,
  ],
})
export class AppModule {}
