/**
 * 메시징 어댑터가 사용하는 Redis 명령어 서브셋을 정의하는 duck-type 인터페이스.
 * ioredis 타입에 직접 의존하지 않아 테스트 시 mock으로 대체하기 쉽다.
 */
export interface RedisLike {
  /**
   * 스트림에 새 엔트리를 추가한다. (trimming 없음)
   */
  xadd(key: string, id: string, ...fieldValues: string[]): Promise<string | null>

  /**
   * 스트림에 새 엔트리를 추가하면서 MAXLEN ~ N으로 대략적으로 trim한다.
   */
  xadd(
    key: string,
    trimStrategy: 'MAXLEN',
    trimOperator: '~',
    maxLen: number,
    id: string,
    ...fieldValues: string[]
  ): Promise<string | null>

  /**
   * Consumer Group 멤버로서 스트림 엔트리를 읽는다 (블로킹 지원).
   *
   * `[streamKey, entries]` 배열을 반환하며, 타임아웃 시 `null`을 반환한다.
   * 각 엔트리는 `[entryId, fields]` 형태이며, `fields`는 key/value가 교대로 나열된 `string[]`.
   */
  xreadgroup(
    groupKeyword: 'GROUP',
    group: string,
    consumer: string,
    blockKeyword: 'BLOCK',
    blockMs: number,
    countKeyword: 'COUNT',
    count: number,
    streamsKeyword: 'STREAMS',
    key: string,
    id: string,
  ): Promise<[string, [string, string[]][]][] | null>

  /**
   * Consumer Group에서 하나 이상의 메시지를 ACK 처리한다.
   */
  xack(key: string, group: string, ...ids: string[]): Promise<number>

  /**
   * 스트림에 Consumer Group을 생성한다.
   * 스트림이 없으면 MKSTREAM으로 자동 생성한다.
   */
  xgroup(
    createKeyword: 'CREATE',
    key: string,
    group: string,
    id: string,
    mkstreamKeyword: 'MKSTREAM',
  ): Promise<'OK'>

  /**
   * Pending Entry List에서 오래된 메시지를 재소유한다 (XAUTOCLAIM).
   *
   * `[nextStartId, [[messageId, fields], ...], [deletedIds]]` 형태를 반환한다.
   */
  xautoclaim(
    key: string,
    group: string,
    consumer: string,
    minIdleMs: number,
    start: string,
    countKeyword: 'COUNT',
    count: number,
  ): Promise<[string, [string, string[]][], string[]]>

  /** Redis 연결을 종료한다. */
  disconnect(): void
}
