import type { ConsumerGroupManagerPort } from '../../core/ports/consumer-group-manager'
import type { RedisLike } from './types'

/**
 * Redis Streams Consumer Group 관리 구현체.
 *
 * NestJS 의존성 없이 `RedisLike`만 주입받아 동작한다.
 */
export class RedisStreamsConsumerGroupManager implements ConsumerGroupManagerPort {
  constructor(private readonly redis: RedisLike) {}

  /**
   * Consumer Group이 없으면 생성한다.
   * 스트림이 없으면 MKSTREAM으로 자동 생성한다.
   * BUSYGROUP 오류(이미 존재)는 무시한다.
   */
  async ensureGroup(stream: string, group: string): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM')
    } catch (error) {
      if (error instanceof Error && error.message.includes('BUSYGROUP')) {
        return
      }
      throw error
    }
  }
}
