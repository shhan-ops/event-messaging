import type { EventSubscriberPort, ReadGroupParams, ClaimPendingParams, StreamMessage } from '../../core/ports/subscriber'
import type { RedisLike } from './types'

/**
 * Redis Streams Consumer Group 기반 구독자.
 *
 * NestJS 의존성 없이 `RedisLike`만 주입받아 동작한다.
 */
export class RedisStreamsSubscriber implements EventSubscriberPort {
  constructor(private readonly redis: RedisLike) {}

  /**
   * XREADGROUP으로 메시지를 읽는다. 다중 스트림을 지원한다.
   */
  async read(params: ReadGroupParams): Promise<StreamMessage[]> {
    const ids = params.ids ?? params.streams.map(() => '>')
    const blockMs = params.blockMs ?? 5000
    const count = params.count ?? 20

    // XREADGROUP GROUP <group> <consumer> BLOCK <ms> COUNT <n> STREAMS <s1> ... <id1> ...
    const result = await (this.redis as any).xreadgroup(
      'GROUP',
      params.group,
      params.consumer,
      'BLOCK',
      blockMs,
      'COUNT',
      count,
      'STREAMS',
      ...params.streams,
      ...ids,
    )

    if (!result) {
      return []
    }

    const messages: StreamMessage[] = []
    for (const [stream, entries] of result as Array<[string, Array<[string, string[]]>]>) {
      for (const [messageId, fields] of entries) {
        messages.push({ stream, messageId, fields })
      }
    }
    return messages
  }

  /**
   * XACK로 메시지 처리 완료를 브로커에 알린다.
   */
  async ack(stream: string, group: string, messageId: string): Promise<void> {
    await this.redis.xack(stream, group, messageId)
  }

  /**
   * XAUTOCLAIM으로 오래된 Pending 메시지를 재소유한다.
   */
  async claim(params: ClaimPendingParams): Promise<StreamMessage[]> {
    const startId = params.startId ?? '0-0'
    const count = params.count ?? 50

    const result = await this.redis.xautoclaim(
      params.stream,
      params.group,
      params.consumer,
      params.minIdleMs,
      startId,
      'COUNT',
      count,
    )

    if (!result || !result[1] || result[1].length === 0) {
      return []
    }

    return result[1].map(([messageId, fields]) => ({
      stream: params.stream,
      messageId,
      fields,
    }))
  }

  /**
   * 연결 정리 (no-op — 연결 수명은 외부에서 관리).
   */
  async close(): Promise<void> {
    return
  }
}
