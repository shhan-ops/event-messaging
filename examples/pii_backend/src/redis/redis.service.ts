import Redis from 'ioredis'
import { Injectable, OnModuleDestroy } from '@nestjs/common'
import { AppConfig } from '@/config/app.config'

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client = new Redis(AppConfig.redisUrl, {
    maxRetriesPerRequest: null,
  })

  getClient(): Redis {
    return this.client
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit()
  }
}
