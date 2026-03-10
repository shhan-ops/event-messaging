import { RedisStreamsSubscriber } from '../../../adapters/redis/redisSubscriber'
import type { RedisLike } from '../../../adapters/redis/types'

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// read()
// ---------------------------------------------------------------------------

describe('RedisStreamsSubscriber.read()', () => {
  it('XREADGROUP에 올바른 인수를 전달한다', async () => {
    const redis = makeMockRedis()
    redis.xreadgroup.mockResolvedValue(null)
    const subscriber = new RedisStreamsSubscriber(redis)

    await subscriber.read({
      group: 'CG_PII',
      consumer: 'pii-svc',
      streams: ['PII:CREATE:REQ'],
      count: 10,
      blockMs: 3000,
    })

    expect(redis.xreadgroup).toHaveBeenCalledWith(
      'GROUP', 'CG_PII', 'pii-svc',
      'BLOCK', 3000,
      'COUNT', 10,
      'STREAMS', 'PII:CREATE:REQ', '>',
    )
  })

  it('타임아웃(null 반환) 시 빈 배열을 반환한다', async () => {
    const redis = makeMockRedis()
    redis.xreadgroup.mockResolvedValue(null)
    const subscriber = new RedisStreamsSubscriber(redis)

    const result = await subscriber.read({ group: 'g', consumer: 'c', streams: ['s'] })

    expect(result).toEqual([])
  })

  it('다중 스트림의 메시지를 올바르게 파싱한다', async () => {
    const redis = makeMockRedis()
    redis.xreadgroup.mockResolvedValue([
      ['stream-a', [['1-0', ['envelope', '{"foo":1}']]]],
      ['stream-b', [['2-0', ['envelope', '{"bar":2}']]]],
    ])
    const subscriber = new RedisStreamsSubscriber(redis)

    const result = await subscriber.read({ group: 'g', consumer: 'c', streams: ['stream-a', 'stream-b'] })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ stream: 'stream-a', messageId: '1-0', fields: ['envelope', '{"foo":1}'] })
    expect(result[1]).toMatchObject({ stream: 'stream-b', messageId: '2-0', fields: ['envelope', '{"bar":2}'] })
  })

  it('ids를 명시하지 않으면 각 스트림에 > 를 기본 ID로 사용한다', async () => {
    const redis = makeMockRedis()
    redis.xreadgroup.mockResolvedValue(null)
    const subscriber = new RedisStreamsSubscriber(redis)

    await subscriber.read({ group: 'g', consumer: 'c', streams: ['s1', 's2'] })

    expect(redis.xreadgroup).toHaveBeenCalledWith(
      'GROUP', 'g', 'c',
      'BLOCK', 5000,
      'COUNT', 20,
      'STREAMS', 's1', 's2', '>', '>',
    )
  })
})

// ---------------------------------------------------------------------------
// ack()
// ---------------------------------------------------------------------------

describe('RedisStreamsSubscriber.ack()', () => {
  it('XACK를 올바른 인수로 호출한다', async () => {
    const redis = makeMockRedis()
    redis.xack.mockResolvedValue(1)
    const subscriber = new RedisStreamsSubscriber(redis)

    await subscriber.ack('my-stream', 'CG_PII', '1-0')

    expect(redis.xack).toHaveBeenCalledWith('my-stream', 'CG_PII', '1-0')
  })
})

// ---------------------------------------------------------------------------
// claim()
// ---------------------------------------------------------------------------

describe('RedisStreamsSubscriber.claim()', () => {
  it('XAUTOCLAIM을 올바른 인수로 호출한다', async () => {
    const redis = makeMockRedis()
    redis.xautoclaim.mockResolvedValue(['0-0', [], []])
    const subscriber = new RedisStreamsSubscriber(redis)

    await subscriber.claim({
      stream: 'PII:CREATE:REQ',
      group: 'CG_PII',
      consumer: 'pii-svc',
      minIdleMs: 300000,
      startId: '0-0',
      count: 50,
    })

    expect(redis.xautoclaim).toHaveBeenCalledWith(
      'PII:CREATE:REQ', 'CG_PII', 'pii-svc', 300000, '0-0', 'COUNT', 50,
    )
  })

  it('결과가 없으면 빈 배열을 반환한다', async () => {
    const redis = makeMockRedis()
    redis.xautoclaim.mockResolvedValue(['0-0', [], []])
    const subscriber = new RedisStreamsSubscriber(redis)

    const result = await subscriber.claim({ stream: 's', group: 'g', consumer: 'c', minIdleMs: 1000 })

    expect(result).toEqual([])
  })

  it('claimed 메시지를 올바르게 파싱한다', async () => {
    const redis = makeMockRedis()
    redis.xautoclaim.mockResolvedValue([
      '0-0',
      [['1-0', ['envelope', '{"x":1}']], ['2-0', ['envelope', '{"x":2}']]],
      [],
    ])
    const subscriber = new RedisStreamsSubscriber(redis)

    const result = await subscriber.claim({ stream: 'PII:CREATE:REQ', group: 'g', consumer: 'c', minIdleMs: 1000 })

    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ stream: 'PII:CREATE:REQ', messageId: '1-0' })
    expect(result[1]).toMatchObject({ stream: 'PII:CREATE:REQ', messageId: '2-0' })
  })
})

// ---------------------------------------------------------------------------
// close()
// ---------------------------------------------------------------------------

describe('RedisStreamsSubscriber.close()', () => {
  it('호출해도 에러 없이 완료된다', async () => {
    const redis = makeMockRedis()
    const subscriber = new RedisStreamsSubscriber(redis)

    await expect(subscriber.close()).resolves.toBeUndefined()
  })
})
