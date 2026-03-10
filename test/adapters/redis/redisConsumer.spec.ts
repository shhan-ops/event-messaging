import { RedisStreamsConsumer } from '../../../adapters/redis/redisConsumer'
import type { RedisLike } from '../../../adapters/redis/types'
import type { Message } from '../../../core/types/message'
import type { EventEnvelope } from '../../../core/types/envelope'

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function makeMockRedis(): jest.Mocked<RedisLike> {
  return {
    xadd: jest.fn(),
    xreadgroup: jest.fn(),
    xack: jest.fn().mockResolvedValue(1),
    xgroup: jest.fn().mockResolvedValue('OK'),
    xautoclaim: jest.fn(),
    disconnect: jest.fn(),
  }
}

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

/** 단일 엔트리를 포함하는 xreadgroup 반환값을 생성한다. */
function makeXreadgroupResult(
  id: string,
  envelope: EventEnvelope<unknown>,
): [string, [string, string[]][]][] {
  return [['stream:orders', [[id, ['envelope', JSON.stringify(envelope)]]]]]
}

/**
 * 순서대로 응답을 반환하는 제어 가능한 xreadgroup mock을 생성한다.
 * - responses 목록을 순서대로 반환한다.
 * - 응답이 소진되면 unblock() 호출 전까지 블로킹된다.
 * - unblock()은 대기 중인 호출을 null로 resolve한다.
 */
function makeControllableXreadgroup(
  responses: ([string, [string, string[]][]][] | null)[] = [],
) {
  let callIndex = 0
  let pendingResolve: ((v: null) => void) | null = null

  const mock = jest.fn().mockImplementation((): Promise<[string, [string, string[]][]][] | null> => {
    if (callIndex < responses.length) {
      return Promise.resolve(responses[callIndex++])
    }
    return new Promise<null>((resolve) => {
      pendingResolve = resolve
    })
  })

  return {
    mock,
    /** 대기 중인 xreadgroup 호출을 null로 resolve한다. */
    unblock() {
      pendingResolve?.(null)
      pendingResolve = null
    },
  }
}

function defaultConfig() {
  return {
    streamKey: 'stream:orders',
    group: 'test-group',
    consumer: 'test-consumer',
    blockMs: 0,
    count: 10,
  }
}

// ---------------------------------------------------------------------------
// 테스트
// ---------------------------------------------------------------------------

describe('RedisStreamsConsumer', () => {
  let mockRedis: jest.Mocked<RedisLike>

  beforeEach(() => {
    jest.resetAllMocks()
    mockRedis = makeMockRedis()
  })

  // -------------------------------------------------------------------------
  // 1. 시작 시 xgroup CREATE 호출
  // -------------------------------------------------------------------------
  it('start 시 xgroup CREATE를 호출한다', async () => {
    const xrg = makeControllableXreadgroup()
    mockRedis.xreadgroup = xrg.mock
    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())

    const startPromise = consumer.start(jest.fn())
    // ensureConsumerGroup + 첫 번째 xreadgroup 호출 완료 대기
    await new Promise<void>((res) => setTimeout(res, 20))

    expect(mockRedis.xgroup).toHaveBeenCalledWith(
      'CREATE',
      'stream:orders',
      'test-group',
      '$',
      'MKSTREAM',
    )

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 2. BUSYGROUP 에러 무시
  // -------------------------------------------------------------------------
  it('xgroup에서 BUSYGROUP 에러가 발생해도 무시한다', async () => {
    mockRedis.xgroup.mockRejectedValue(new Error('BUSYGROUP Consumer Group name already exists'))
    const xrg = makeControllableXreadgroup()
    mockRedis.xreadgroup = xrg.mock
    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())

    const startPromise = consumer.start(jest.fn())
    await new Promise<void>((res) => setTimeout(res, 20))

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await expect(startPromise).resolves.toBeUndefined()
  })

  // -------------------------------------------------------------------------
  // 3. xreadgroup이 null 반환 시 핸들러 미호출
  // -------------------------------------------------------------------------
  it('xreadgroup이 null을 반환하면 핸들러를 호출하지 않는다', async () => {
    const xrg = makeControllableXreadgroup([null])
    mockRedis.xreadgroup = xrg.mock
    const handler = jest.fn()
    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())

    const startPromise = consumer.start(handler)
    await new Promise<void>((res) => setTimeout(res, 20))

    expect(handler).not.toHaveBeenCalled()

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 4. 핸들러에 올바른 Message 객체 전달
  // -------------------------------------------------------------------------
  it('올바른 형태의 Message 객체와 함께 핸들러를 호출한다', async () => {
    const envelope = makeEnvelope()
    const xrg = makeControllableXreadgroup([makeXreadgroupResult('42-0', envelope)])

    let capturedMsg: Message<unknown> | undefined
    const handler = jest.fn().mockImplementation(async (msg: Message<unknown>) => {
      capturedMsg = msg
    })

    mockRedis.xreadgroup = xrg.mock
    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())

    const startPromise = consumer.start(handler)
    await new Promise<void>((res) => setTimeout(res, 20))

    expect(handler).toHaveBeenCalledTimes(1)
    expect(capturedMsg).toBeDefined()
    expect(capturedMsg!.id).toBe('42-0')
    expect(capturedMsg!.envelope).toEqual(envelope)
    expect(capturedMsg!.receivedAt).toBeInstanceOf(Date)

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 5. autoOnSuccess: 핸들러 성공 후 xack 호출
  // -------------------------------------------------------------------------
  it('autoOnSuccess 모드에서 핸들러 완료 후 xack를 호출한다', async () => {
    const envelope = makeEnvelope()
    const xrg = makeControllableXreadgroup([makeXreadgroupResult('10-0', envelope)])
    mockRedis.xreadgroup = xrg.mock
    const handler = jest.fn().mockResolvedValue(undefined)

    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())
    const startPromise = consumer.start(handler, { ackMode: 'autoOnSuccess' })
    await new Promise<void>((res) => setTimeout(res, 20))

    expect(mockRedis.xack).toHaveBeenCalledWith('stream:orders', 'test-group', '10-0')

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 6. autoOnSuccess: 핸들러 throw 시 xack 미호출
  // -------------------------------------------------------------------------
  it('autoOnSuccess 모드에서 핸들러가 throw하면 xack를 호출하지 않는다', async () => {
    const envelope = makeEnvelope()
    const xrg = makeControllableXreadgroup([makeXreadgroupResult('20-0', envelope)])
    mockRedis.xreadgroup = xrg.mock
    const handler = jest.fn().mockRejectedValue(new Error('handler boom'))

    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())
    const startPromise = consumer.start(handler, { ackMode: 'autoOnSuccess' })
    await new Promise<void>((res) => setTimeout(res, 20))
    jest.restoreAllMocks()

    expect(mockRedis.xack).not.toHaveBeenCalled()

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 7. manual ack: ack() 호출 시 xack 실행
  // -------------------------------------------------------------------------
  it('manual 핸들러에서 명시적으로 ack()를 호출하면 xack가 실행된다', async () => {
    const envelope = makeEnvelope()
    const xrg = makeControllableXreadgroup([makeXreadgroupResult('30-0', envelope)])
    mockRedis.xreadgroup = xrg.mock
    const handler = jest.fn().mockImplementation(
      async (_msg: Message<unknown>, ack: () => Promise<void>) => {
        await ack()
      },
    )

    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())
    const startPromise = consumer.start(handler, { ackMode: 'manual' })
    await new Promise<void>((res) => setTimeout(res, 20))

    expect(mockRedis.xack).toHaveBeenCalledWith('stream:orders', 'test-group', '30-0')

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 8. manual ack: ack()는 멱등성을 가진다
  // -------------------------------------------------------------------------
  it('ack()를 두 번 호출해도 xack는 한 번만 실행된다', async () => {
    const envelope = makeEnvelope()
    const xrg = makeControllableXreadgroup([makeXreadgroupResult('31-0', envelope)])
    mockRedis.xreadgroup = xrg.mock
    const handler = jest.fn().mockImplementation(
      async (_msg: Message<unknown>, ack: () => Promise<void>) => {
        await ack()
        await ack() // 두 번째 호출은 no-op이어야 한다
      },
    )

    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())
    const startPromise = consumer.start(handler, { ackMode: 'manual' })
    await new Promise<void>((res) => setTimeout(res, 20))

    expect(mockRedis.xack).toHaveBeenCalledTimes(1)

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 9. decodeErrorPolicy="ack": 잘못된 JSON 메시지 xack 처리
  // -------------------------------------------------------------------------
  it('decodeErrorPolicy가 "ack"이면 JSON 파싱 실패 시 xack를 호출한다', async () => {
    const xrg = makeControllableXreadgroup([
      [['stream:orders', [['bad-1', ['envelope', 'NOT_VALID_JSON']]]]],
    ])
    mockRedis.xreadgroup = xrg.mock

    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const consumer = new RedisStreamsConsumer(mockRedis, {
      ...defaultConfig(),
      decodeErrorPolicy: 'ack',
    })
    const handler = jest.fn()
    const startPromise = consumer.start(handler)
    await new Promise<void>((res) => setTimeout(res, 20))
    jest.restoreAllMocks()

    expect(mockRedis.xack).toHaveBeenCalledWith('stream:orders', 'test-group', 'bad-1')
    expect(handler).not.toHaveBeenCalled()

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 10. decodeErrorPolicy="skip": 잘못된 JSON 메시지 xack 미처리
  // -------------------------------------------------------------------------
  it('decodeErrorPolicy가 "skip"이면 JSON 파싱 실패 시 xack를 호출하지 않는다', async () => {
    const xrg = makeControllableXreadgroup([
      [['stream:orders', [['bad-2', ['envelope', '{{invalid']]]]],
    ])
    mockRedis.xreadgroup = xrg.mock

    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    const consumer = new RedisStreamsConsumer(mockRedis, {
      ...defaultConfig(),
      decodeErrorPolicy: 'skip',
    })
    const handler = jest.fn()
    const startPromise = consumer.start(handler)
    await new Promise<void>((res) => setTimeout(res, 20))
    jest.restoreAllMocks()

    expect(mockRedis.xack).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()

    await consumer.stop({ mode: 'immediate' })
    xrg.unblock()
    await Promise.resolve()
    await startPromise
  })

  // -------------------------------------------------------------------------
  // 11. stop({ mode: "immediate" })는 즉시 resolve
  // -------------------------------------------------------------------------
  it('stop({ mode: "immediate" })는 in-flight 메시지 완료를 기다리지 않고 즉시 반환한다', async () => {
    // 영원히 resolve되지 않는 핸들러 — 처리 중인 메시지 시뮬레이션
    const handler = jest.fn().mockReturnValue(new Promise<void>(() => undefined))
    const envelope = makeEnvelope()
    let callIndex = 0
    // 첫 번째 호출은 메시지를 반환, 이후 호출은 영원히 블로킹
    mockRedis.xreadgroup.mockImplementation(() => {
      if (callIndex++ === 0) return Promise.resolve(makeXreadgroupResult('99-0', envelope))
      return new Promise<null>(() => undefined)
    })

    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())
    const startPromise = consumer.start(handler)

    // 핸들러가 호출될 때까지 대기
    await new Promise<void>((res) => setTimeout(res, 20))
    expect(handler).toHaveBeenCalledTimes(1)

    // stop(immediate)는 drain 없이 즉시 resolve되어야 한다
    await expect(consumer.stop({ mode: 'immediate' })).resolves.toBeUndefined()

    // startPromise는 hanging 상태로 남음 (핸들러가 never resolve) — 이 테스트에서는 허용
    startPromise.catch(() => undefined)
  })

  // -------------------------------------------------------------------------
  // 12. xreadgroup 에러: 로그 기록, 250ms 대기 후 루프 재개
  // -------------------------------------------------------------------------
  it('xreadgroup이 throw하면 에러를 로그하고 250ms 후 루프를 재개한다', async () => {
    jest.useFakeTimers()

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    let callCount = 0
    // eslint-disable-next-line prefer-const
    let unblockPending: (() => void) = () => undefined

    mockRedis.xreadgroup.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject(new Error('network error'))
      }
      // 두 번째 이후 호출은 unblock 전까지 블로킹
      return new Promise<null>((resolve) => {
        unblockPending = () => resolve(null)
      })
    })

    const consumer = new RedisStreamsConsumer(mockRedis, defaultConfig())
    const startPromise = consumer.start(jest.fn())

    // 마이크로태스크 플러시: ensureConsumerGroup + 첫 번째 xreadgroup 거절 + catch 블록 진입
    for (let i = 0; i < 10; i++) await Promise.resolve()

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[event-messaging:redis]'),
      expect.objectContaining({ error: expect.any(Error) }),
    )

    // catch 블록 내부의 250ms setTimeout을 앞으로 진행
    jest.advanceTimersByTime(250)
    for (let i = 0; i < 10; i++) await Promise.resolve()

    // 250ms 지연 후 두 번째 xreadgroup 호출이 이루어져야 한다
    expect(mockRedis.xreadgroup).toHaveBeenCalledTimes(2)

    await consumer.stop({ mode: 'immediate' })
    unblockPending() // 대기 중인 xreadgroup 해제
    await Promise.resolve()
    await startPromise

    consoleSpy.mockRestore()
    jest.useRealTimers()
  })
})
