import { RedisStreamsConsumerGroupManager } from '../../../adapters/redis/redisConsumerGroupManager'
import type { RedisLike } from '../../../adapters/redis/types'

function makeMockRedis(): jest.Mocked<RedisLike> {
  return {
    xadd: jest.fn(),
    xreadgroup: jest.fn(),
    xack: jest.fn(),
    xgroup: jest.fn(),
    xautoclaim: jest.fn(),
    disconnect: jest.fn(),
  }
}

describe('RedisStreamsConsumerGroupManager.ensureGroup()', () => {
  it('XGROUP CREATE MKSTREAM를 올바른 인수로 호출한다', async () => {
    const redis = makeMockRedis()
    redis.xgroup.mockResolvedValue('OK')
    const manager = new RedisStreamsConsumerGroupManager(redis)

    await manager.ensureGroup('PII:CREATE:REQ', 'CG_PII')

    expect(redis.xgroup).toHaveBeenCalledWith('CREATE', 'PII:CREATE:REQ', 'CG_PII', '0', 'MKSTREAM')
  })

  it('BUSYGROUP 오류는 무시한다', async () => {
    const redis = makeMockRedis()
    redis.xgroup.mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists'))
    const manager = new RedisStreamsConsumerGroupManager(redis)

    await expect(manager.ensureGroup('s', 'g')).resolves.toBeUndefined()
  })

  it('BUSYGROUP 이외의 오류는 다시 던진다', async () => {
    const redis = makeMockRedis()
    redis.xgroup.mockRejectedValue(new Error('WRONGTYPE Operation against a key holding the wrong kind of value'))
    const manager = new RedisStreamsConsumerGroupManager(redis)

    await expect(manager.ensureGroup('s', 'g')).rejects.toThrow('WRONGTYPE')
  })
})
