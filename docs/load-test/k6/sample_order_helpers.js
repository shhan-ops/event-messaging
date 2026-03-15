import exec from 'k6/execution'

export function buildPayload(orderNo, runtime) {
  const piiProfile = buildPiiProfile(orderNo, runtime)

  return {
    orderNo,
    recipientName: piiProfile.recipientName,
    recipientPhonePrimary: piiProfile.recipientPhonePrimary,
    recipientCountry: 'KR',
    recipientFullAddress: piiProfile.recipientFullAddress,
    recipientPostalCode: piiProfile.recipientPostalCode,
    deliveryMessage: `load-test:${runtime.profileName}:${runtime.piiDataMode}`,
  }
}

export function buildUniqueOrderNo(runtime) {
  const ts = Date.now().toString(36).toUpperCase()
  const vu = pad(exec.vu.idInTest || __VU, 4)
  const iteration = pad(exec.scenario.iterationInTest, 8)
  return trimOrderNo(`${runtime.orderPrefix}-${ts}-${vu}-${iteration}`)
}

export function buildDuplicateOrderNo(runtime) {
  const group = pad(Math.floor(((exec.vu.idInTest || __VU) - 1) / 2), 4)
  const bucket = pad(Math.floor(exec.scenario.iterationInTest / 3), 6)
  return trimOrderNo(`${runtime.orderPrefix}-D-${group}-${bucket}`)
}

export function shouldUseDuplicateOrderNo(runtime) {
  if (runtime.profileName !== 'duplicate') {
    return false
  }

  return Math.random() < runtime.duplicateRate
}

export function buildRequestId(orderNo, runtime) {
  const iteration = pad(exec.scenario.iterationInTest, 8)
  return `${runtime.profileName}:${orderNo}:${iteration}`
}

export function pickSampleOrderId(body) {
  return body.sampleOrderId || body.sample_order_id || body.id || null
}

export function safeJson(response) {
  try {
    return response.json()
  } catch {
    return null
  }
}

export function nextPollIntervalMs(intervalMs, runtime) {
  const nextInterval = Math.min(intervalMs * runtime.pollBackoffFactor, runtime.pollMaxIntervalMs)
  return Math.max(1, Math.round(applyJitter(nextInterval, runtime.pollJitterRatio)))
}

export function formatSummary(summary, runtime, sampledE2eRatePerSec) {
  const createDuration = summary.metrics['http_req_duration{endpoint:create}']
  const statusDuration = summary.metrics['http_req_duration{endpoint:status}']
  const e2eDuration = summary.metrics.e2e_completion_ms
  const successRate = summary.metrics.create_success_rate
  const e2eRate = summary.metrics.e2e_success_rate
  const dropped = summary.metrics.dropped_iterations
  const vus = summary.metrics.vus
  const vusMax = summary.metrics.vus_max

  return [
    '',
    'sample_order load test summary',
    `profile: ${runtime.profileName}`,
    `base_url: ${runtime.baseUrl}`,
    `sampled_e2e_rate_per_sec: ${sampledE2eRatePerSec}`,
    '',
    `create success rate: ${formatRate(successRate)}`,
    `create p95: ${formatTrend(createDuration, 'p(95)')} ms`,
    `create p99: ${formatTrend(createDuration, 'p(99)')} ms`,
    `status p95: ${formatTrend(statusDuration, 'p(95)')} ms`,
    `status p99: ${formatTrend(statusDuration, 'p(99)')} ms`,
    `e2e success rate: ${formatRate(e2eRate)}`,
    `e2e p95: ${formatTrend(e2eDuration, 'p(95)')} ms`,
    `e2e p99: ${formatTrend(e2eDuration, 'p(99)')} ms`,
    `active vus: ${formatGauge(vus)}`,
    `max vus seen: ${formatGauge(vusMax)}`,
    `dropped iterations: ${formatCount(dropped)}`,
    '',
  ].join('\n')
}

function buildPiiProfile(orderNo, runtime) {
  if (runtime.piiDataMode === 'fixed') {
    return {
      recipientName: 'Load Test User',
      recipientPhonePrimary: '01012345678',
      recipientFullAddress: '서울시 강남구 테헤란로 123',
      recipientPostalCode: '06236',
    }
  }

  const seed = stableNumber(orderNo)
  const roadNo = 1 + (seed % 999)
  const detailNo = 1 + (Math.floor(seed / 1000) % 999)
  const postalCode = pad(10000 + (seed % 89999), 5)
  const phoneSuffix = pad(seed % 100000000, 8)
  const nameSuffix = pad(seed % 100000, 5)

  return {
    recipientName: `Load User ${nameSuffix}`,
    recipientPhonePrimary: `010${phoneSuffix}`,
    recipientFullAddress: `서울시 강남구 테헤란로 ${roadNo} ${detailNo}호`,
    recipientPostalCode: postalCode,
  }
}

function applyJitter(value, ratio) {
  if (ratio <= 0) {
    return value
  }

  const delta = (Math.random() * 2 - 1) * ratio
  return value * (1 + delta)
}

function formatRate(metric) {
  if (!metric || typeof metric.values?.rate !== 'number') {
    return 'n/a'
  }

  return `${(metric.values.rate * 100).toFixed(2)}%`
}

function formatTrend(metric, key) {
  if (!metric || typeof metric.values?.[key] !== 'number') {
    return 'n/a'
  }

  return metric.values[key].toFixed(2)
}

function formatCount(metric) {
  if (!metric || typeof metric.values?.count !== 'number') {
    return 'n/a'
  }

  return String(metric.values.count)
}

function formatGauge(metric) {
  if (!metric || typeof metric.values !== 'object') {
    return 'n/a'
  }

  if (typeof metric.values.value === 'number') {
    return String(metric.values.value)
  }

  if (typeof metric.values.max === 'number') {
    return String(metric.values.max)
  }

  return 'n/a'
}

function pad(value, size) {
  return String(value).padStart(size, '0')
}

function trimOrderNo(orderNo) {
  return orderNo.slice(0, 40)
}

function stableNumber(value) {
  let hash = 0

  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }

  return hash
}
