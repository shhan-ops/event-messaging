import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SequelizeModule } from '@nestjs/sequelize'
import { piiDatabaseConfig } from '@/database/database.config'
import { PiiModule } from '@/pii/pii.module'
import { PiiStreamModule } from '@/pii/stream/pii-stream.module'
import { RedisModule } from '@/redis/redis.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SequelizeModule.forRoot(piiDatabaseConfig),
    RedisModule,
    PiiModule,
    PiiStreamModule,
  ],
})
export class AppModule {}
