import type { EventEnvelope } from './envelope'

/**
 * 브로커로부터 수신한 메시지. EventEnvelope에 전송 레이어 메타데이터를 추가한다.
 *
 * @template T - payload 타입
 */
export interface Message<T> {
  /** 브로커가 부여한 메시지 ID */
  id: string
  /** 역직렬화된 이벤트 봉투 */
  envelope: EventEnvelope<T>
  /** 컨슈머가 메시지를 수신한 시각 */
  receivedAt: Date
}

/**
 * 이벤트 발행 성공 시 반환되는 결과.
 */
export interface PublishResult {
  /** 브로커가 부여한 발행 메시지 ID */
  messageId: string
  /** 메시지가 발행된 destination (스트림 / 토픽) */
  destination: string
}
