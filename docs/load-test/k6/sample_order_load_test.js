import http from 'k6/http'
import { check, sleep } from 'k6'

import { runtime, DEFAULT_HEADERS } from './sample_order_config.js'
import {
  completedPolls,
  createFailures,
  createLatency,
  createResponseOkRate,
  createSuccessRate,
  e2eCompletion,
  e2eSuccessRate,
  e2eTimeouts,
  nonCompletedPolls,
  pollAttempts,
  pollSuccessRate,
} from './sample_order_metrics.js'
import { buildProfile, buildScenarios, buildThresholds, resolveE2eRatePerSec } from './sample_order_profiles.js'
import {
  buildDuplicateOrderNo,
  buildPayload,
  buildRequestId,
  buildUniqueOrderNo,
  formatSummary,
  nextPollIntervalMs,
  pickSampleOrderId,
  safeJson,
  shouldUseDuplicateOrderNo,
} from './sample_order_helpers.js'

const profile = buildProfile(runtime.profileName)
const sampledE2eRatePerSec = resolveE2eRatePerSec(profile, runtime)

export const options = {
  scenarios: buildScenarios(profile, runtime),
  thresholds: buildThresholds(runtime),
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
}

export function setup() {
  if (!runtime.baseUrl) {
    throw new Error('BASE_URL env is required')
  }

  return {
    baseUrl: runtime.baseUrl,
    profileName: runtime.profileName,
  }
}

export default function (data) {
  createSampleOrder(data, 'create_only')
}

export function createAndPollSampled(data) {
  const created = createSampleOrder(data, 'sampled_e2e')
  if (!created) {
    return
  }

  pollUntilCompleted({
    sampleOrderId: created.sampleOrderId,
    orderNo: created.orderNo,
    startedAt: created.startedAt,
    baseUrl: data.baseUrl,
    profileName: data.profileName,
  })
}

export function handleSummary(summary) {
  const report = {
    profile: runtime.profileName,
    baseUrl: runtime.baseUrl,
    thresholds: options.thresholds,
    metrics: summary.metrics,
    notes: {
      createScenario: 'create throughput only',
      sampledE2eScenario: runtime.enablePollScenario
        ? 'independent sampled create+poll validation flow'
        : 'disabled',
      sampledE2eRatePerSec,
      legacyPollSampleRate: runtime.legacyPollSampleRate,
      warning: 'If dropped_iterations grows, inspect k6 client saturation separately from SUT saturation.',
    },
  }

  const result = {
    stdout: formatSummary(summary, runtime, sampledE2eRatePerSec),
  }

  if (__ENV.SUMMARY_JSON) {
    result[__ENV.SUMMARY_JSON] = JSON.stringify(report, null, 2)
  }

  return result
}

function createSampleOrder(data, flow) {
  const orderNo = shouldUseDuplicateOrderNo(runtime)
    ? buildDuplicateOrderNo(runtime)
    : buildUniqueOrderNo(runtime)

  const payload = buildPayload(orderNo, runtime)
  const requestId = buildRequestId(orderNo, runtime)
  const params = {
    headers: {
      ...DEFAULT_HEADERS,
      'x-request-id': requestId,
    },
    tags: {
      endpoint: 'create',
      profile: data.profileName,
      flow,
    },
  }

  const startedAt = Date.now()
  const response = http.post(`${data.baseUrl}/sample-order`, JSON.stringify(payload), params)

  createLatency.add(response.timings.duration)
  createSuccessRate.add(response.status >= 200 && response.status < 300)

  const responseOk = check(response, {
    'create status is 2xx': (r) => r.status >= 200 && r.status < 300,
    'create has json body': (r) => {
      const parsed = safeJson(r)
      return !!parsed && typeof parsed === 'object'
    },
  })
  createResponseOkRate.add(responseOk)

  if (!(response.status >= 200 && response.status < 300)) {
    createFailures.add(1)
    return null
  }

  const body = safeJson(response)
  if (!body) {
    createFailures.add(1)
    return null
  }

  const sampleOrderId = pickSampleOrderId(body)
  if (!sampleOrderId) {
    createFailures.add(1)
    return null
  }

  return {
    sampleOrderId,
    orderNo,
    startedAt,
  }
}

function pollUntilCompleted({ sampleOrderId, orderNo, startedAt, baseUrl, profileName }) {
  const deadline = Date.now() + runtime.pollTimeoutMs
  const url = `${baseUrl}/sample-order/${sampleOrderId}`
  let intervalMs = runtime.pollInitialIntervalMs

  while (Date.now() <= deadline) {
    pollAttempts.add(1)

    const pollResponse = http.get(url, {
      headers: DEFAULT_HEADERS,
      tags: {
        endpoint: 'status',
        profile: profileName,
      },
    })

    if (pollResponse.status >= 200 && pollResponse.status < 300) {
      pollSuccessRate.add(true)

      const body = safeJson(pollResponse)
      if (body) {
        const outboxStatus = body.outboxStatus?.status

        if (body.piiId || outboxStatus === 'COMPLETED') {
          completedPolls.add(1)
          e2eSuccessRate.add(true)
          e2eCompletion.add(Date.now() - startedAt)
          return
        }

        if (outboxStatus === 'FAILED' || outboxStatus === 'DLQ') {
          nonCompletedPolls.add(1)
          e2eSuccessRate.add(false)
          return
        }
      }
    } else {
      pollSuccessRate.add(false)
    }

    sleep(intervalMs / 1000)
    intervalMs = nextPollIntervalMs(intervalMs, runtime)
  }

  e2eTimeouts.add(1)
  e2eSuccessRate.add(false)
  nonCompletedPolls.add(1)

  if (Math.random() < runtime.timeoutLogSampleRate) {
    console.error(
      `[E2E_TIMEOUT] profile=${profileName} sampleOrderId=${sampleOrderId} orderNo=${orderNo} timeoutMs=${runtime.pollTimeoutMs}`,
    )
  }
}
