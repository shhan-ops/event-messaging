import type { EventEnvelope } from '../../core/types/envelope'
import type { Message } from '../../core/types/message'
import type {
  AckFn,
  AutoAckHandler,
  ConsumerOptions,
  EventConsumerPort,
  ManualAckHandler,
  MessageHandler,
  ShutdownOptions,
} from '../../core/ports/consumer'
import type { RedisLike } from './types'

/**
 * {@link RedisStreamsConsumer} 설정 옵션.
 */
export interface RedisConsumerConfig {
  /** 소비할 Redis 스트림 키 */
  streamKey: string
  /** Consumer Group 이름 */
  group: string
  /** Consumer 이름 (그룹 내 고유값) */
  consumer: string
  /**
   * 새 메시지를 기다리며 블로킹할 시간(ms).
   * @default 2000
   */
  blockMs?: number
  /**
   * XREADGROUP 호출당 최대 메시지 수.
   * @default 10
   */
  count?: number
  /**
   * 메시지 디코딩 실패(잘못된 JSON) 시 동작 정책.
   * `"ack"` — 메시지를 ACK 처리하여 재전달을 방지한다.
   * `"skip"` — ACK 하지 않고 남겨두어 재전달될 수 있도록 한다.
   * @default "ack"
   */
  decodeErrorPolicy?: 'ack' | 'skip'
}

/**
 * XREADGROUP을 사용하여 Redis 스트림에서 이벤트를 소비하는 구현체.
 *
 * {@link EventConsumerPort}를 구현한다.
 */
export class RedisStreamsConsumer<T = unknown> implements EventConsumerPort<T> {
  private readonly redis: RedisLike
  private readonly config: Required<RedisConsumerConfig>

  private stopRequested = false
  private inFlightCount = 0
  private stopResolve: (() => void) | undefined

  constructor(redis: RedisLike, config: RedisConsumerConfig) {
    this.redis = redis
    this.config = {
      blockMs: 2000,
      count: 10,
      decodeErrorPolicy: 'ack',
      ...config,
    }
  }

  /**
   * 스트림에서 메시지 소비를 시작한다.
   *
   * @param handler - 메시지 핸들러 (auto-ack 또는 manual-ack)
   * @param options - 컨슈머 옵션
   */
  async start(handler: MessageHandler<T>, options?: ConsumerOptions): Promise<void> {
    const ackMode = options?.ackMode ?? 'autoOnSuccess'
    const onAckMissing = options?.onAckMissing ?? 'warn'

    await this.ensureConsumerGroup()

    this.stopRequested = false

    while (!this.stopRequested) {
      let result: [string, [string, string[]][]][] | null

      try {
        result = await this.redis.xreadgroup(
          'GROUP',
          this.config.group,
          this.config.consumer,
          'BLOCK',
          this.config.blockMs,
          'COUNT',
          this.config.count,
          'STREAMS',
          this.config.streamKey,
          '>',
        )
      } catch (err) {
        console.error('[event-messaging:redis] xreadgroup error', {
          streamKey: this.config.streamKey,
          group: this.config.group,
          error: err,
        })
        await new Promise<void>((resolve) => setTimeout(resolve, 250))
        continue
      }

      if (result === null) {
        continue
      }

      const [[, entries]] = result

      for (const [id, fields] of entries) {
        if (this.stopRequested) {
          break
        }

        let envelopeJson: string
        try {
          envelopeJson = this.pickField(fields, 'envelope')
        } catch (err) {
          console.error('[event-messaging:redis] envelope 필드 누락', { id, error: err })
          if (this.config.decodeErrorPolicy === 'ack') {
            await this.redis.xack(this.config.streamKey, this.config.group, id)
          }
          continue
        }

        let envelope: EventEnvelope<T>
        try {
          envelope = JSON.parse(envelopeJson) as EventEnvelope<T>
        } catch (err) {
          console.error('[event-messaging:redis] envelope JSON 파싱 실패', { id, error: err })
          if (this.config.decodeErrorPolicy === 'ack') {
            await this.redis.xack(this.config.streamKey, this.config.group, id)
          }
          continue
        }

        const message: Message<T> = { id, envelope, receivedAt: new Date() }

        let ackCalled = false
        const ack: AckFn = async () => {
          if (ackCalled) return
          ackCalled = true
          await this.redis.xack(this.config.streamKey, this.config.group, id)
        }

        this.inFlightCount++
        try {
          if (ackMode === 'autoOnSuccess') {
            await (handler as AutoAckHandler<T>)(message)
            await ack()
          } else {
            await (handler as ManualAckHandler<T>)(message, ack)
            if (!ackCalled) {
              await this.handleAckMissing(onAckMissing, id, ack)
            }
          }
        } catch (err) {
          console.error('[event-messaging:redis] 핸들러 오류', {
            id,
            eventType: message.envelope.type,
            error: err,
          })
          // 핸들러 오류 시 ACK 하지 않는다
        } finally {
          this.inFlightCount--
          if (this.stopRequested && this.inFlightCount === 0) {
            this.stopResolve?.()
          }
        }
      }
    }

    this.stopResolve?.()
  }

  /**
   * 컨슈머를 중지한다.
   *
   * `"drain"` 모드(기본값)에서는 처리 중인 모든 메시지가 완료될 때까지 대기 후 resolve한다.
   * `"immediate"` 모드에서는 즉시 반환한다.
   *
   * @param options - Shutdown 옵션
   */
  async stop(options?: ShutdownOptions): Promise<void> {
    const mode = options?.mode ?? 'drain'
    const drainTimeoutMs = options?.drainTimeoutMs ?? 30_000
    const onDrainTimeout = options?.onDrainTimeout ?? 'force'
    this.stopRequested = true

    if (mode === 'immediate') {
      return
    }

    if (this.inFlightCount > 0) {
      const drained = new Promise<void>((resolve) => {
        this.stopResolve = resolve
      })
      const timedOut = new Promise<void>((resolve) => setTimeout(resolve, drainTimeoutMs))

      await Promise.race([drained, timedOut])

      if (onDrainTimeout === 'keepRunning' && this.inFlightCount > 0) {
        // 타임아웃 후 루프를 계속 실행하도록 stop 플래그를 복원한다
        this.stopRequested = false
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private 헬퍼
  // ---------------------------------------------------------------------------

  private async ensureConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.config.streamKey, this.config.group, '$', 'MKSTREAM')
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('BUSYGROUP')) {
        // Consumer Group이 이미 존재하는 경우 — 정상
        return
      }
      throw err
    }
  }

  private pickField(fields: string[], key: string): string {
    const idx = fields.indexOf(key)
    if (idx === -1 || idx + 1 >= fields.length) {
      throw new Error(`[event-messaging:redis] field "${key}" not found in message fields`)
    }
    return fields[idx + 1]
  }

  private async handleAckMissing(
    policy: NonNullable<ConsumerOptions['onAckMissing']>,
    id: string,
    ack: AckFn,
  ): Promise<void> {
    if (policy === 'warn') {
      console.warn('[event-messaging:redis] manual 핸들러에서 ack가 호출되지 않았습니다', { id })
    } else if (policy === 'error') {
      console.error('[event-messaging:redis] manual 핸들러에서 ack가 호출되지 않았습니다', { id })
    } else if (policy === 'autoAck') {
      await ack()
    }
  }
}
