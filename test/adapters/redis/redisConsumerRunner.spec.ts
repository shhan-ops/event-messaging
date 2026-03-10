import {
  RedisStreamsConsumerRunner,
  createReadParams,
  createClaimParams,
  type ConsumerRunnerConfig,
} from '../../../adapters/redis'
import type { EventSubscriberPort, StreamMessage } from '../../../core'

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

function makeSubscriber(): jest.Mocked<EventSubscriberPort> {
  return {
    read: jest.fn().mockResolvedValue([]),
    ack: jest.fn().mockResolvedValue(undefined),
    claim: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  }
}

function makeConfig(overrides: Partial<ConsumerRunnerConfig> = {}): ConsumerRunnerConfig {
  return {
    name: 'test-runner',
    group: 'CG_TEST',
    consumer: 'test-consumer',
    streams: ['stream-a'],
    pollIntervalMs: 10,
    claimIntervalMs: 10000,
    claimMinIdleMs: 300000,
    ...overrides,
  }
}

function makeMessage(stream = 'stream-a', messageId = '1-0'): StreamMessage {
  return { stream, messageId, fields: ['envelope', '{"foo":1}'] }
}

// ---------------------------------------------------------------------------
// createReadParams / createClaimParams
// ---------------------------------------------------------------------------

describe('createReadParams()', () => {
  it('기본값이 올바르게 적용된다', () => {
    const result = createReadParams({ name: 'n', group: 'g', consumer: 'c', streams: ['s'] })
    expect(result).toEqual({ group: 'g', consumer: 'c', streams: ['s'], count: 20, blockMs: 5000 })
  })

  it('설정 값이 우선 적용된다', () => {
    const result = createReadParams(makeConfig({ readCount: 5, readBlockMs: 1000 }))
    expect(result.count).toBe(5)
    expect(result.blockMs).toBe(1000)
  })
})

describe('createClaimParams()', () => {
  it('기본값이 올바르게 적용된다', () => {
    const result = createClaimParams({ name: 'n', group: 'g', consumer: 'c', streams: ['s'] }, 's')
    expect(result).toEqual({ stream: 's', group: 'g', consumer: 'c', minIdleMs: 300000, count: 50, startId: '0-0' })
  })

  it('설정 값이 우선 적용된다', () => {
    const result = createClaimParams(makeConfig({ claimMinIdleMs: 60000, claimCount: 10 }), 'stream-a')
    expect(result.minIdleMs).toBe(60000)
    expect(result.count).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// pollOnce()
// ---------------------------------------------------------------------------

describe('RedisStreamsConsumerRunner.pollOnce()', () => {
  it('메시지가 없으면 onMessage를 호출하지 않는다', async () => {
    const subscriber = makeSubscriber()
    const onMessage = jest.fn()
    const runner = new RedisStreamsConsumerRunner(subscriber, makeConfig(), { onMessage })

    await runner.pollOnce()

    expect(onMessage).not.toHaveBeenCalled()
    expect(subscriber.ack).not.toHaveBeenCalled()
  })

  it('메시지 처리 성공 시 ACK를 호출한다', async () => {
    const subscriber = makeSubscriber()
    subscriber.read.mockResolvedValue([makeMessage()])
    const onMessage = jest.fn().mockResolvedValue(undefined)
    const runner = new RedisStreamsConsumerRunner(subscriber, makeConfig(), { onMessage })

    await runner.pollOnce()

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(subscriber.ack).toHaveBeenCalledWith('stream-a', 'CG_TEST', '1-0')
  })

  it('메시지 처리 실패 시 ACK를 호출하지 않는다', async () => {
    const subscriber = makeSubscriber()
    subscriber.read.mockResolvedValue([makeMessage()])
    const onMessage = jest.fn().mockRejectedValue(new Error('처리 실패'))
    const runner = new RedisStreamsConsumerRunner(subscriber, makeConfig(), { onMessage })

    await runner.pollOnce()

    expect(subscriber.ack).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// claimOnce()
// ---------------------------------------------------------------------------

describe('RedisStreamsConsumerRunner.claimOnce()', () => {
  it('각 스트림에 대해 claim을 호출한다', async () => {
    const subscriber = makeSubscriber()
    const config = makeConfig({ streams: ['s1', 's2'] })
    const onMessage = jest.fn().mockResolvedValue(undefined)
    const runner = new RedisStreamsConsumerRunner(subscriber, config, { onMessage })

    await runner.claimOnce()

    expect(subscriber.claim).toHaveBeenCalledTimes(2)
    expect(subscriber.claim).toHaveBeenNthCalledWith(1, expect.objectContaining({ stream: 's1' }))
    expect(subscriber.claim).toHaveBeenNthCalledWith(2, expect.objectContaining({ stream: 's2' }))
  })

  it('claimed 메시지를 처리하고 ACK한다', async () => {
    const subscriber = makeSubscriber()
    subscriber.claim.mockResolvedValue([makeMessage('stream-a', '3-0')])
    const onMessage = jest.fn().mockResolvedValue(undefined)
    const runner = new RedisStreamsConsumerRunner(subscriber, makeConfig(), { onMessage })

    await runner.claimOnce()

    expect(onMessage).toHaveBeenCalledTimes(1)
    expect(subscriber.ack).toHaveBeenCalledWith('stream-a', 'CG_TEST', '3-0')
  })
})

// ---------------------------------------------------------------------------
// onError 핸들러
// ---------------------------------------------------------------------------

describe('RedisStreamsConsumerRunner 에러 처리', () => {
  it('onError 핸들러가 있으면 루프 에러 시 호출된다', async () => {
    const subscriber = makeSubscriber()
    subscriber.read.mockResolvedValue([makeMessage()])
    const processingError = new Error('처리 실패')
    const onMessage = jest.fn().mockRejectedValue(processingError)
    const onError = jest.fn().mockResolvedValue(undefined)
    const runner = new RedisStreamsConsumerRunner(subscriber, makeConfig(), { onMessage, onError })

    await runner.pollOnce()

    expect(onError).toHaveBeenCalledWith(processingError)
  })
})

// ---------------------------------------------------------------------------
// stop()
// ---------------------------------------------------------------------------

describe('RedisStreamsConsumerRunner.stop()', () => {
  it('stop() 호출 시 subscriber.close()를 호출한다', async () => {
    const subscriber = makeSubscriber()
    const runner = new RedisStreamsConsumerRunner(subscriber, makeConfig(), { onMessage: jest.fn() })

    await runner.stop()

    expect(subscriber.close).toHaveBeenCalledTimes(1)
  })
})
