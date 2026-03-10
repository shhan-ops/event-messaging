import type { EventEnvelope } from '../../core/types/envelope'
import type { PublishResult } from '../../core/types/message'
import type { EventPublisherPort, EventTypeRouter, PublishOptions } from '../../core/ports/publisher'
import type { RedisLike } from './types'

/**
 * {@link RedisStreamsPublisher} 설정 옵션.
 */
export interface RedisPublisherConfig {
  /** 이벤트 타입을 Redis 스트림 키로 변환하는 라우터 */
  router: EventTypeRouter
  /**
   * 설정 시 `XADD ... MAXLEN ~ N` 옵션으로 스트림을 대략 N개 이하로 trim한다.
   */
  maxLenApprox?: number
}

/**
 * Redis Streams에 이벤트를 발행하는 구현체.
 *
 * XADD 명령을 사용하며 {@link EventPublisherPort}를 구현한다.
 */
export class RedisStreamsPublisher<T = unknown> implements EventPublisherPort<T> {
  private readonly redis: RedisLike
  private readonly config: RedisPublisherConfig

  constructor(redis: RedisLike, config: RedisPublisherConfig) {
    this.redis = redis
    this.config = config
  }

  /**
   * 이벤트 봉투를 Redis 스트림에 발행한다.
   *
   * @param envelope - 발행할 이벤트 봉투
   * @param options  - 발행 시 override 옵션 (destination 명시 등)
   */
  async publish(envelope: EventEnvelope<T>, options?: PublishOptions): Promise<PublishResult> {
    const destination = options?.destination ?? this.config.router.resolve(envelope.type)
    const json = JSON.stringify(envelope)

    let result: string | null

    if (this.config.maxLenApprox !== undefined) {
      result = await this.redis.xadd(
        destination,
        'MAXLEN',
        '~',
        this.config.maxLenApprox,
        '*',
        'envelope',
        json,
      )
    } else {
      result = await this.redis.xadd(destination, '*', 'envelope', json)
    }

    if (result === null) {
      throw new Error(
        `[event-messaging:redis] xadd returned null for destination "${destination}"`,
      )
    }

    return { messageId: result, destination }
  }
}
