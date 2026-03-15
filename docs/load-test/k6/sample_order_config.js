const BASE_URL = String(__ENV.BASE_URL || '').replace(/\/+$/, '')
const AUTH_TOKEN = String(__ENV.AUTH_TOKEN || '')

export const runtime = {
  baseUrl: BASE_URL,
  profileName: String(__ENV.PROFILE || 'million_day'),
  orderPrefix: String(__ENV.ORDER_PREFIX || 'LT'),
  piiDataMode: String(__ENV.PII_DATA_MODE || 'unique'),
  enablePollScenario: parseBoolean(__ENV.ENABLE_POLL_SCENARIO, true),
  pollTimeoutMs: positiveInt(__ENV.POLL_TIMEOUT_MS, 45000),
  pollInitialIntervalMs: positiveInt(__ENV.POLL_INITIAL_INTERVAL_MS, 2000),
  pollMaxIntervalMs: positiveInt(__ENV.POLL_MAX_INTERVAL_MS, 5000),
  pollBackoffFactor: positiveNumber(__ENV.POLL_BACKOFF_FACTOR, 1.5),
  pollJitterRatio: clamp(parseFloat(__ENV.POLL_JITTER_RATIO || '0.2'), 0, 1),
  duplicateRate: clamp(parseFloat(__ENV.DUPLICATE_RATE || '0.2'), 0, 1),
  timeoutLogSampleRate: clamp(parseFloat(__ENV.TIMEOUT_LOG_SAMPLE_RATE || '0.02'), 0, 1),
  strictNoDrops: parseBoolean(__ENV.STRICT_NO_DROPS, false),
  e2eRatePerSecOverride: optionalPositiveNumber(__ENV.E2E_RATE_PER_SEC),
  legacyPollSampleRate: optionalRate(__ENV.POLL_SAMPLE_RATE),
}

export const DEFAULT_HEADERS = buildBaseHeaders(AUTH_TOKEN)

function buildBaseHeaders(authToken) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  return headers
}

function parseBoolean(raw, defaultValue) {
  if (typeof raw === 'undefined') {
    return defaultValue
  }

  return String(raw).toLowerCase() === 'true'
}

function positiveInt(raw, defaultValue) {
  const value = parseInt(String(raw || ''), 10)
  return Number.isFinite(value) && value > 0 ? value : defaultValue
}

function positiveNumber(raw, defaultValue) {
  const value = parseFloat(String(raw || ''))
  return Number.isFinite(value) && value > 0 ? value : defaultValue
}

function optionalPositiveNumber(raw) {
  if (typeof raw === 'undefined' || raw === '') {
    return null
  }

  const value = parseFloat(String(raw))
  return Number.isFinite(value) && value > 0 ? value : null
}

function optionalRate(raw) {
  if (typeof raw === 'undefined' || raw === '') {
    return null
  }

  const value = parseFloat(String(raw))
  if (!Number.isFinite(value)) {
    return null
  }

  return clamp(value, 0, 1)
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min
  }

  return Math.max(min, Math.min(max, value))
}
