import type { EventSubscriberPort, StreamMessage, ReadGroupParams, ClaimPendingParams } from '../../core/ports/subscriber'

/**
 * ConsumerRunner 설정.
 */
export interface ConsumerRunnerConfig {
  /** 로그 식별자 */
  name: string
  group: string
  consumer: string
  /** 소비할 스트림 키 목록 */
  streams: string[]
  readCount?: number
  readBlockMs?: number
  /** 폴링 루프 간격(ms). 기본값: 100 */
  pollIntervalMs?: number
  /** XAUTOCLAIM 최소 idle 시간(ms). 기본값: 300_000 */
  claimMinIdleMs?: number
  /** XAUTOCLAIM 1회 최대 처리 수. 기본값: 50 */
  claimCount?: number
  /** Claim 루프 간격(ms). 기본값: claimMinIdleMs */
  claimIntervalMs?: number
}

/**
 * 메시지 처리 핸들러 모음.
 */
export interface ConsumerRunnerHandlers {
  /** 메시지 처리 핸들러. 성공 시 ACK, 예외 시 ACK 하지 않아 PEL에 유지된다. */
  onMessage: (message: StreamMessage) => Promise<void>
  /** 루프 레벨 에러 핸들러. 미설정 시 console.error 사용. */
  onError?: (error: unknown) => Promise<void> | void
}

/**
 * ConsumerRunnerConfig로부터 XREADGROUP 파라미터를 생성한다.
 */
export function createReadParams(config: ConsumerRunnerConfig): ReadGroupParams {
  return {
    group: config.group,
    consumer: config.consumer,
    streams: config.streams,
    count: config.readCount ?? 20,
    blockMs: config.readBlockMs ?? 5000,
  }
}

/**
 * ConsumerRunnerConfig와 스트림 키로부터 XAUTOCLAIM 파라미터를 생성한다.
 */
export function createClaimParams(config: ConsumerRunnerConfig, stream: string): ClaimPendingParams {
  return {
    stream,
    group: config.group,
    consumer: config.consumer,
    minIdleMs: config.claimMinIdleMs ?? 300_000,
    count: config.claimCount ?? 50,
    startId: '0-0',
  }
}

/**
 * poll 루프(신규 메시지)와 claim 루프(오래된 Pending 메시지)를 함께 관리하는 Consumer 실행기.
 *
 * NestJS Logger에 의존하지 않으며 console을 사용한다.
 * 메시지 처리 성공 시 ACK, 실패 시 ACK 하지 않아 PEL에 메시지가 남는다.
 */
export class RedisStreamsConsumerRunner {
  private readonly pollIntervalMs: number
  private readonly claimIntervalMs: number
  private running = false
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private claimTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly subscriber: EventSubscriberPort,
    private readonly config: ConsumerRunnerConfig,
    private readonly handlers: ConsumerRunnerHandlers,
  ) {
    this.pollIntervalMs = config.pollIntervalMs ?? 100
    this.claimIntervalMs = config.claimIntervalMs ?? config.claimMinIdleMs ?? 300_000
  }

  /**
   * poll 루프와 claim 루프를 시작한다. 이미 실행 중이면 no-op.
   */
  start(): void {
    if (this.running) {
      return
    }
    this.running = true
    console.log(
      `[ConsumerRunner:${this.config.name}] started (group=${this.config.group}, consumer=${this.config.consumer})`,
    )
    this.startPollLoop()
    this.startClaimLoop()
  }

  /**
   * 루프를 중지하고 subscriber를 닫는다.
   */
  async stop(): Promise<void> {
    this.running = false

    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }

    if (this.claimTimer) {
      clearTimeout(this.claimTimer)
      this.claimTimer = null
    }

    await this.subscriber.close()
    console.log(`[ConsumerRunner:${this.config.name}] stopped`)
  }

  private startPollLoop(): void {
    const poll = async () => {
      if (!this.running) return

      try {
        await this.pollOnce()
      } catch (error) {
        await this.handleError(error)
      }

      if (this.running) {
        this.pollTimer = setTimeout(() => void poll(), this.pollIntervalMs)
      }
    }

    void poll()
  }

  private startClaimLoop(): void {
    const claim = async () => {
      if (!this.running) return

      try {
        await this.claimOnce()
      } catch (error) {
        await this.handleError(error)
      }

      if (this.running) {
        this.claimTimer = setTimeout(() => void claim(), this.claimIntervalMs)
      }
    }

    this.claimTimer = setTimeout(() => void claim(), this.claimIntervalMs)
  }

  /** 단일 XREADGROUP 호출로 새 메시지를 처리한다. */
  async pollOnce(): Promise<void> {
    const messages = await this.subscriber.read(createReadParams(this.config))
    for (const message of messages) {
      await this.processMessage(message)
    }
  }

  /** 각 스트림에 대해 XAUTOCLAIM 호출로 오래된 Pending 메시지를 처리한다. */
  async claimOnce(): Promise<void> {
    for (const stream of this.config.streams) {
      const messages = await this.subscriber.claim(createClaimParams(this.config, stream))
      for (const message of messages) {
        await this.processMessage(message)
      }
    }
  }

  /** 메시지를 처리하고 성공 시 ACK한다. 실패 시 ACK하지 않아 PEL에 유지된다. */
  async processMessage(message: StreamMessage): Promise<void> {
    try {
      await this.handlers.onMessage(message)
      await this.subscriber.ack(message.stream, this.config.group, message.messageId)
    } catch (error) {
      console.error(
        `[ConsumerRunner:${this.config.name}] message processing failed (stream=${message.stream}, messageId=${message.messageId})`,
        error,
      )
      await this.handleError(error)
    }
  }

  private async handleError(error: unknown): Promise<void> {
    if (this.handlers.onError) {
      await this.handlers.onError(error)
      return
    }
    if (error instanceof Error) {
      console.error(`[ConsumerRunner:${this.config.name}]`, error.message, error.stack)
      return
    }
    console.error(`[ConsumerRunner:${this.config.name}]`, String(error))
  }
}
