/**
 * Redis Stream에서 수신한 원시 메시지.
 */
export interface StreamMessage {
  /** 메시지가 속한 스트림 키 */
  stream: string
  /** Redis가 부여한 메시지 ID (예: "1710000000000-0") */
  messageId: string
  /** fields 배열 전체 (key-value 교대 나열) */
  fields: string[]
}

/**
 * XREADGROUP 요청 파라미터.
 */
export interface ReadGroupParams {
  group: string
  consumer: string
  /** 소비할 스트림 키 목록 */
  streams: string[]
  /** 각 스트림에 대한 시작 ID. 기본값: 모든 스트림에 `>` */
  ids?: string[]
  count?: number
  blockMs?: number
}

/**
 * XAUTOCLAIM 요청 파라미터.
 */
export interface ClaimPendingParams {
  stream: string
  group: string
  consumer: string
  minIdleMs: number
  /** 탐색 시작 ID. 기본값: '0-0' */
  startId?: string
  count?: number
}

/**
 * Consumer Group 기반으로 스트림 메시지를 읽고 ACK/CLAIM 하는 Port.
 */
export interface EventSubscriberPort {
  read(params: ReadGroupParams): Promise<StreamMessage[]>
  ack(stream: string, group: string, messageId: string): Promise<void>
  claim(params: ClaimPendingParams): Promise<StreamMessage[]>
  close(): Promise<void>
}
