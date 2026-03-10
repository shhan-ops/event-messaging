import { RedisStreamsPublisher } from '../../../adapters/redis/redisPublisher'
import type { RedisLike } from '../../../adapters/redis/types'
import type { EventTypeRouter } from '../../../core/ports/publisher'
import type { EventEnvelope } from '../../../core/types/envelope'

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function makeEnvelope(type = 'order.created'): EventEnvelope<{ orderId: string }> {
  return {
    eventId: 'evt-1',
    type,
    occurredAt: '2024-01-01T00:00:00.000Z',
    source: 'order-service',
    schemaVersion: 1,
    payload: { orderId: 'ord-1' },
  }
}

function makeRouter(destination = 'stream:orders'): jest.Mocked<EventTypeRouter> {
  return { resolve: jest.fn().mockReturnValue(destination) }
}

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
// 테스트
// ---------------------------------------------------------------------------

describe('RedisStreamsPublisher', () => {
  let mockRedis: jest.Mocked<RedisLike>
  let mockRouter: jest.Mocked<EventTypeRouter>

  beforeEach(() => {
    mockRedis = makeMockRedis()
    mockRouter = makeRouter()
  })

  it('options.destination 없이 라우터가 결정한 destination으로 xadd를 호출한다', async () => {
    mockRedis.xadd.mockResolvedValue('1-0')
    const publisher = new RedisStreamsPublisher(mockRedis, { router: mockRouter })
    const envelope = makeEnvelope('order.created')

    await publisher.publish(envelope)

    expect(mockRouter.resolve).toHaveBeenCalledWith('order.created')
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      'stream:orders',
      '*',
      'envelope',
      JSON.stringify(envelope),
    )
  })

  it('options.destination이 있으면 해당 값을 사용하고 라우터를 호출하지 않는다', async () => {
    mockRedis.xadd.mockResolvedValue('2-0')
    const publisher = new RedisStreamsPublisher(mockRedis, { router: mockRouter })
    const envelope = makeEnvelope('order.created')

    await publisher.publish(envelope, { destination: 'custom:stream' })

    expect(mockRouter.resolve).not.toHaveBeenCalled()
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      'custom:stream',
      '*',
      'envelope',
      JSON.stringify(envelope),
    )
  })

  it('{ messageId, destination }을 올바르게 반환한다', async () => {
    mockRedis.xadd.mockResolvedValue('123-0')
    const publisher = new RedisStreamsPublisher(mockRedis, { router: mockRouter })
    const envelope = makeEnvelope()

    const result = await publisher.publish(envelope)

    expect(result).toEqual({ messageId: '123-0', destination: 'stream:orders' })
  })

  it('maxLenApprox 설정 시 MAXLEN ~ N 인자와 함께 xadd를 호출한다', async () => {
    mockRedis.xadd.mockResolvedValue('3-0')
    const publisher = new RedisStreamsPublisher(mockRedis, {
      router: mockRouter,
      maxLenApprox: 1000,
    })
    const envelope = makeEnvelope()

    await publisher.publish(envelope)

    expect(mockRedis.xadd).toHaveBeenCalledWith(
      'stream:orders',
      'MAXLEN',
      '~',
      1000,
      '*',
      'envelope',
      JSON.stringify(envelope),
    )
  })

  it('maxLenApprox 미설정 시 MAXLEN 인자 없이 xadd를 호출한다', async () => {
    mockRedis.xadd.mockResolvedValue('4-0')
    const publisher = new RedisStreamsPublisher(mockRedis, { router: mockRouter })
    const envelope = makeEnvelope()

    await publisher.publish(envelope)

    const [, secondArg] = mockRedis.xadd.mock.calls[0]
    expect(secondArg).not.toBe('MAXLEN')
  })

  it('xadd가 null을 반환하면 에러를 던진다', async () => {
    mockRedis.xadd.mockResolvedValue(null)
    const publisher = new RedisStreamsPublisher(mockRedis, { router: mockRouter })

    await expect(publisher.publish(makeEnvelope())).rejects.toThrow(
      '[event-messaging:redis]',
    )
  })

  it('xadd가 throw하면 에러를 그대로 전파한다', async () => {
    const boom = new Error('Redis connection lost')
    mockRedis.xadd.mockRejectedValue(boom)
    const publisher = new RedisStreamsPublisher(mockRedis, { router: mockRouter })

    await expect(publisher.publish(makeEnvelope())).rejects.toThrow('Redis connection lost')
  })
})
