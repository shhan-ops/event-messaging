export function buildProfile(name) {
  const common = {
    executor: 'ramping-arrival-rate',
    timeUnit: '1s',
    preAllocatedVUs: 80,
    maxVUs: 400,
  }

  switch (name) {
    case 'smoke_short':
      return {
        createScenario: {
          ...common,
          stages: [
            { target: 1, duration: '30s' },
            { target: 3, duration: '45s' },
            { target: 0, duration: '15s' },
          ],
        },
        createDuration: '90s',
        sampleE2eRatePerSec: 1,
        e2ePreAllocatedVUs: 6,
        e2eMaxVUs: 20,
      }
    case 'smoke':
      return {
        createScenario: {
          ...common,
          stages: [
            { target: 1, duration: '2m' },
            { target: 3, duration: '3m' },
            { target: 0, duration: '1m' },
          ],
        },
        createDuration: '6m',
        sampleE2eRatePerSec: 1,
        e2ePreAllocatedVUs: 8,
        e2eMaxVUs: 24,
      }
    case 'peak':
      return {
        createScenario: {
          ...common,
          stages: [
            { target: 12, duration: '5m' },
            { target: 25, duration: '10m' },
            { target: 50, duration: '10m' },
            { target: 75, duration: '5m' },
            { target: 0, duration: '5m' },
          ],
        },
        createDuration: '35m',
        sampleE2eRatePerSec: 1,
      }
    case 'stress_high':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 120,
          maxVUs: 600,
          stages: [
            { target: 12, duration: '3m' },
            { target: 25, duration: '5m' },
            { target: 50, duration: '5m' },
            { target: 100, duration: '5m' },
            { target: 150, duration: '5m' },
            { target: 0, duration: '3m' },
          ],
        },
        createDuration: '26m',
        sampleE2eRatePerSec: 2,
      }
    case 'stress_resume_mid':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 120,
          maxVUs: 600,
          stages: [
            { target: 50, duration: '3m' },
            { target: 100, duration: '5m' },
            { target: 150, duration: '5m' },
            { target: 0, duration: '3m' },
          ],
        },
        createDuration: '16m',
        sampleE2eRatePerSec: 2,
      }
    case 'stress_resume_high':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 140,
          maxVUs: 700,
          stages: [
            { target: 100, duration: '3m' },
            { target: 150, duration: '5m' },
            { target: 0, duration: '3m' },
          ],
        },
        createDuration: '11m',
        sampleE2eRatePerSec: 2,
      }
    case 'stress_high_short':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 140,
          maxVUs: 700,
          stages: [
            { target: 100, duration: '1m' },
            { target: 150, duration: '1m' },
            { target: 0, duration: '30s' },
          ],
        },
        createDuration: '5m',
        sampleE2eRatePerSec: 2,
      }
    case 'stress_recovery_mid':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 120,
          maxVUs: 600,
          stages: [
            { target: 50, duration: '3m' },
            { target: 100, duration: '5m' },
            { target: 150, duration: '5m' },
            { target: 12, duration: '10m' },
            { target: 0, duration: '3m' },
          ],
        },
        createDuration: '26m',
        sampleE2eRatePerSec: 2,
      }
    case 'stress_recovery_high':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 140,
          maxVUs: 700,
          stages: [
            { target: 100, duration: '3m' },
            { target: 150, duration: '5m' },
            { target: 12, duration: '12m' },
            { target: 0, duration: '3m' },
          ],
        },
        createDuration: '23m',
        sampleE2eRatePerSec: 2,
      }
    case 'spike_high':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 160,
          maxVUs: 800,
          stages: [
            { target: 10, duration: '2m' },
            { target: 50, duration: '2m' },
            { target: 100, duration: '2m' },
            { target: 150, duration: '2m' },
            { target: 0, duration: '2m' },
          ],
        },
        createDuration: '10m',
        sampleE2eRatePerSec: 2,
      }
    case 'spike_resume_high':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 160,
          maxVUs: 800,
          stages: [
            { target: 50, duration: '1m' },
            { target: 100, duration: '2m' },
            { target: 150, duration: '2m' },
            { target: 0, duration: '2m' },
          ],
        },
        createDuration: '7m',
        sampleE2eRatePerSec: 2,
      }
    case 'spike_recovery_high':
      return {
        createScenario: {
          executor: 'ramping-arrival-rate',
          timeUnit: '1s',
          preAllocatedVUs: 160,
          maxVUs: 800,
          stages: [
            { target: 50, duration: '1m' },
            { target: 100, duration: '2m' },
            { target: 150, duration: '2m' },
            { target: 12, duration: '10m' },
            { target: 0, duration: '2m' },
          ],
        },
        createDuration: '17m',
        sampleE2eRatePerSec: 2,
      }
    case 'duplicate':
      return {
        createScenario: {
          ...common,
          stages: [
            { target: 5, duration: '5m' },
            { target: 12, duration: '10m' },
            { target: 25, duration: '10m' },
            { target: 0, duration: '5m' },
          ],
        },
        createDuration: '30m',
        sampleE2eRatePerSec: 1,
      }
    case 'soak':
      return {
        createScenario: {
          executor: 'constant-arrival-rate',
          rate: 12,
          timeUnit: '1s',
          duration: '2h',
          preAllocatedVUs: 60,
          maxVUs: 240,
        },
        createDuration: '2h',
        sampleE2eRatePerSec: 1,
      }
    case 'million_day':
    default:
      return {
        createScenario: {
          ...common,
          stages: [
            { target: 5, duration: '5m' },
            { target: 12, duration: '15m' },
            { target: 25, duration: '15m' },
            { target: 50, duration: '10m' },
            { target: 75, duration: '5m' },
            { target: 0, duration: '5m' },
          ],
        },
        createDuration: '55m',
        sampleE2eRatePerSec: 1,
      }
  }
}

export function buildScenarios(profile, runtime) {
  const scenarios = {
    sample_order_create: {
      ...profile.createScenario,
      exec: 'default',
    },
  }

  if (runtime.enablePollScenario) {
    scenarios.sample_order_e2e_sampled = {
      executor: 'constant-arrival-rate',
      rate: resolveE2eRatePerSec(profile, runtime),
      timeUnit: '1s',
      duration: profile.createDuration,
      preAllocatedVUs: profile.e2ePreAllocatedVUs || 10,
      maxVUs: profile.e2eMaxVUs || 50,
      exec: 'createAndPollSampled',
    }
  }

  return scenarios
}

export function buildThresholds(runtime) {
  const thresholds = {
    create_success_rate: ['rate>0.99'],
    create_response_ok_rate: ['rate>0.99'],
    'http_req_duration{endpoint:create}': ['p(95)<1000', 'p(99)<2000'],
    create_latency_ms: ['p(95)<1000', 'p(99)<2000'],
  }

  if (runtime.enablePollScenario) {
    thresholds['http_req_duration{endpoint:status}'] = ['p(95)<1500', 'p(99)<3000']
    thresholds.e2e_success_rate = ['rate>0.95']
    thresholds.e2e_completion_ms = ['p(95)<15000', 'p(99)<30000']
    thresholds.poll_success_rate = ['rate>0.99']
  }

  if (runtime.strictNoDrops) {
    thresholds.dropped_iterations = ['count==0']
  }

  return thresholds
}

export function resolveE2eRatePerSec(profile, runtime) {
  if (runtime.e2eRatePerSecOverride) {
    return Math.max(1, Math.ceil(runtime.e2eRatePerSecOverride))
  }

  if (runtime.legacyPollSampleRate !== null) {
    return Math.max(1, Math.ceil(getPeakCreateRate(profile.createScenario) * runtime.legacyPollSampleRate))
  }

  return Math.max(1, Math.ceil(profile.sampleE2eRatePerSec || 1))
}

function getPeakCreateRate(createScenario) {
  if (typeof createScenario.rate === 'number') {
    return createScenario.rate
  }

  return createScenario.stages.reduce((max, stage) => Math.max(max, stage.target), 1)
}
