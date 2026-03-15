import { Inject, Injectable, Logger } from '@nestjs/common'
import type { EventEnvelope, EventPublisherPort } from '@shhan-ops/event-messaging'
import { randomUUID } from 'crypto'
import { AppConfig } from '@/config/app.config'
import { PiiService } from '@/pii/pii.service'
import { mapToPiiRequest, parseCreateRequested } from './pii-stream.mapper'
import {
  NonRetryableStreamError,
  OmsPiiCreateRequested,
  PiiCreatedEvent,
  PiiFailedEvent,
  PII_STREAM_EVENT_TYPE,
  PII_STREAM_PUBLISHER,
} from './pii-stream.type'

@Injectable()
export class PiiStreamService {
  private readonly logger = new Logger(PiiStreamService.name)

  constructor(
    private readonly piiService: PiiService,
    @Inject(PII_STREAM_PUBLISHER)
    private readonly publisher: EventPublisherPort<PiiCreatedEvent | PiiFailedEvent>,
  ) {}

  async process(rawMessage: string | OmsPiiCreateRequested): Promise<void> {
    let requestIdempotencyKey = 'unknown'
    let traceId = 'unknown'

    try {
      const request = parseCreateRequested(rawMessage)
      requestIdempotencyKey = request.idempotency_key
      traceId = request.metadata?.trace_id || request.idempotency_key

      const mapped = mapToPiiRequest(request)
      const result = await this.piiService.createOrReuseFromStream({
        source: mapped.source,
        idempotencyKey: request.idempotency_key,
        request: mapped.payload,
      })

      const successEvent: PiiCreatedEvent = {
        pii_id: result.piiId,
        idempotency_key: request.idempotency_key,
        created: result.created,
        reused: result.reused,
        trace_id: traceId,
      }

      await this.publisher.publish(this.buildEnvelope(PII_STREAM_EVENT_TYPE.CREATED, successEvent, traceId))
    } catch (error) {
      const failedEvent = this.toFailedEvent(error, requestIdempotencyKey, traceId)
      await this.publisher.publish(this.buildEnvelope(PII_STREAM_EVENT_TYPE.FAILED, failedEvent, traceId))
      this.logger.error(`pii stream failed: ${failedEvent.error}`)
    }
  }

  private toFailedEvent(error: unknown, idempotencyKey: string, traceId: string): PiiFailedEvent {
    if (error instanceof NonRetryableStreamError) {
      return {
        idempotency_key: idempotencyKey,
        error: error.message,
        error_code: error.errorCode,
        retryable: false,
        attempt_count: 1,
        trace_id: traceId,
      }
    }

    if (error instanceof Error) {
      return {
        idempotency_key: idempotencyKey,
        error: error.message,
        error_code: 'PII_PROCESSING_FAILED',
        retryable: true,
        attempt_count: 1,
        trace_id: traceId,
      }
    }

    return {
      idempotency_key: idempotencyKey,
      error: 'unknown stream processing error',
      error_code: 'UNKNOWN_STREAM_ERROR',
      retryable: true,
      attempt_count: 1,
      trace_id: traceId,
    }
  }

  private buildEnvelope(
    type: typeof PII_STREAM_EVENT_TYPE.CREATED | typeof PII_STREAM_EVENT_TYPE.FAILED,
    payload: PiiCreatedEvent | PiiFailedEvent,
    traceId: string,
  ): EventEnvelope<PiiCreatedEvent | PiiFailedEvent> {
    return {
      eventId: randomUUID(),
      type,
      occurredAt: new Date().toISOString(),
      source: AppConfig.serviceName,
      schemaVersion: 1,
      payload,
      headers: {
        traceId,
        correlationId: payload.idempotency_key,
        dedupKey: payload.idempotency_key,
      },
    }
  }
}
