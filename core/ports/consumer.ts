import type { Message } from '../types/message'

/** 메시지 처리 완료를 브로커에 알리는 ACK 함수. */
export type AckFn = () => Promise<void>

/**
 * ACK를 직접 관리하지 않는 핸들러.
 * 핸들러가 정상 반환되면 프레임워크가 자동으로 ACK를 호출한다.
 *
 * @template T - payload 타입
 */
export type AutoAckHandler<T> = (message: Message<T>) => Promise<void>

/**
 * ACK를 직접 관리하는 핸들러.
 * 핸들러 내부에서 적절한 시점에 `ack()`를 호출해야 한다.
 *
 * @template T - payload 타입
 */
export type ManualAckHandler<T> = (message: Message<T>, ack: AckFn) => Promise<void>

/**
 * 메시지 핸들러 — auto-ack 또는 manual-ack 방식.
 *
 * @template T - payload 타입
 */
export type MessageHandler<T> = AutoAckHandler<T> | ManualAckHandler<T>

/**
 * Graceful shutdown 동작을 제어하는 옵션.
 */
export interface ShutdownOptions {
  /**
   * `"drain"` — 처리 중인 메시지가 모두 완료될 때까지 대기 후 종료.
   * `"immediate"` — 즉시 종료 (처리 중인 메시지 완료 보장 없음).
   * @default "drain"
   */
  mode?: 'drain' | 'immediate'
  /**
   * drain 모드에서 in-flight 메시지 완료를 기다리는 최대 시간(ms).
   * @default 30_000
   */
  drainTimeoutMs?: number
  /**
   * drain 타임아웃 경과 후 동작.
   * `"force"` — 타임아웃 시 강제 종료.
   * `"keepRunning"` — 타임아웃 후에도 계속 실행 유지.
   * @default "force"
   */
  onDrainTimeout?: 'force' | 'keepRunning'
}

/**
 * `EventConsumerPort.start()`에 전달하는 옵션.
 */
export interface ConsumerOptions {
  /**
   * `"autoOnSuccess"` — 핸들러 정상 완료 후 자동 ACK.
   * `"manual"` — 핸들러가 직접 ack()를 호출해야 함.
   * @default "autoOnSuccess"
   */
  ackMode?: 'autoOnSuccess' | 'manual'
  /**
   * manual-ack 핸들러가 ack() 호출 없이 종료될 때의 동작.
   * `"warn"` — 경고 로그.
   * `"error"` — 에러 로그.
   * `"autoAck"` — 자동으로 ACK 처리.
   * @default "warn"
   */
  onAckMissing?: 'warn' | 'error' | 'autoAck'
  /**
   * 동시에 처리하는 최대 메시지 수.
   * @default 1
   */
  concurrency?: number
  /** Shutdown 동작 설정 */
  shutdown?: ShutdownOptions
}

/**
 * 브로커에서 이벤트를 소비하는 Port 인터페이스.
 *
 * @template T - payload 타입
 */
export interface EventConsumerPort<T = unknown> {
  /**
   * 메시지 소비를 시작하고 각 메시지마다 `handler`를 호출한다.
   *
   * @param handler - 메시지 핸들러 (auto-ack 또는 manual-ack)
   * @param options - 컨슈머 옵션
   */
  start(handler: MessageHandler<T>, options?: ConsumerOptions): Promise<void>

  /**
   * 컨슈머를 중지한다.
   *
   * @param options - Shutdown 옵션
   */
  stop(options?: ShutdownOptions): Promise<void>
}
