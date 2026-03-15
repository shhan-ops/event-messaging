import { Counter, Rate, Trend } from 'k6/metrics'

export const createSuccessRate = new Rate('create_success_rate')
export const createResponseOkRate = new Rate('create_response_ok_rate')
export const createFailures = new Counter('create_failures')
export const createLatency = new Trend('create_latency_ms')

export const pollAttempts = new Counter('poll_attempts')
export const pollSuccessRate = new Rate('poll_success_rate')
export const e2eSuccessRate = new Rate('e2e_success_rate')
export const e2eTimeouts = new Counter('e2e_timeouts')
export const completedPolls = new Counter('completed_polls')
export const nonCompletedPolls = new Counter('non_completed_polls')
export const e2eCompletion = new Trend('e2e_completion_ms')
