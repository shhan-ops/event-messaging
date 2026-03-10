import type { EventEnvelope } from '../types/envelope'
import type { PublishResult } from '../types/message'

/**
 * 발행 시 전달할 수 있는 옵션.
 */
export interface PublishOptions {
  /** 라우터가 결정한 destination을 override할 때 사용 */
  destination?: string
}

/**
 * 이벤트 타입을 브로커 destination(스트림 키, 토픽 등)으로 변환하는 라우터.
 */
export interface EventTypeRouter {
  /**
   * 주어진 이벤트 타입 문자열에 해당하는 destination을 반환한다.
   */
  resolve(eventType: string): string
}

/**
 * 브로커에 이벤트를 발행하는 Port 인터페이스.
 *
 * @template T - 봉투 payload 타입
 */
export interface EventPublisherPort<T = unknown> {
  /**
   * 이벤트 봉투를 브로커에 발행한다.
   *
   * @param envelope - 발행할 이벤트 봉투
   * @param options  - 발행 시 override 옵션 (destination 지정 등)
   */
  publish(envelope: EventEnvelope<T>, options?: PublishOptions): Promise<PublishResult>
}
