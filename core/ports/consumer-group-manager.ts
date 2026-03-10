/**
 * 스트림 Consumer Group을 관리하는 Port.
 */
export interface ConsumerGroupManagerPort {
  /**
   * Consumer Group이 없으면 생성한다. 스트림이 없으면 MKSTREAM으로 자동 생성한다.
   * 이미 그룹이 존재하면(BUSYGROUP) 무시한다.
   */
  ensureGroup(stream: string, group: string): Promise<void>
}
