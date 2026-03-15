import { Injectable } from '@nestjs/common'
import { Op, Transaction } from 'sequelize'
import { addSeconds } from 'date-fns'
import { createHash } from 'crypto'
import { AppConfig } from '@/config/app.config'
import { PiiOutbox, PiiOutboxStatus } from './model/pii-outbox.model'
import { PiiOutboxRepository } from './repository/pii-outbox.repository'

export interface PiiOutboxSourceData {
  customerName: string
  primaryPhone: string
  country?: string
  fullAddress: string
  postalCode?: string | null
  deliveryMessage?: string | null
}

export interface PiiOutboxMetadata {
  sourceTable: string
  sourceId: number
  orderNo: string
  traceId: string
}

@Injectable()
export class PiiOutboxService {
  constructor(private readonly piiOutboxRepository: PiiOutboxRepository) {}

  buildIdempotencyKey(data: PiiOutboxSourceData, sourceTable: string, sourceId: number): string {
    const raw = [
      sourceTable,
      sourceId,
      data.customerName.trim().replace(/\s+/g, ' '),
      data.primaryPhone.replace(/\D/g, ''),
      data.fullAddress.trim(),
      (data.postalCode || '').trim(),
    ].join('|')

    return `oms.sample_orders.v2:${createHash('sha256').update(raw).digest('hex')}`
  }

  buildCreateEventPayload(data: PiiOutboxSourceData, metadata: PiiOutboxMetadata, idempotencyKey: string) {
    const encode = (value?: string | null) => Buffer.from(value || '', 'utf8').toString('base64')

    return {
      idempotency_key: idempotencyKey,
      payload: {
        encrypted_fields: {
          name: encode(data.customerName),
          primary_phone: encode(data.primaryPhone),
          country: encode(data.country || 'KR'),
          full_address: encode(data.fullAddress),
          postal_code: encode(data.postalCode || ''),
          delivery_message: encode(data.deliveryMessage || ''),
        },
        encryption_method: 'MOCK-BASE64',
      },
      metadata: {
        request_context: 'sample_order_create',
        source_table: metadata.sourceTable,
        source_id: metadata.sourceId,
        order_no: metadata.orderNo,
        source_service_type: 'OMS',
        trace_id: metadata.traceId,
      },
    }
  }

  createOutbox(
    params: {
      idempotencyKey: string
      sourceTable: string
      sourceId: number
      payload: Record<string, unknown>
    },
    transaction: Transaction,
  ) {
    return this.piiOutboxRepository.create(
      {
        idempotencyKey: params.idempotencyKey,
        sourceTable: params.sourceTable,
        sourceId: params.sourceId,
        status: 'INIT',
        eventPayload: params.payload,
      },
      transaction,
    )
  }

  findByIdempotencyKey(idempotencyKey: string) {
    return this.piiOutboxRepository.findOne({ idempotencyKey })
  }

  findPending(limit: number) {
    return this.piiOutboxRepository.findAll({
      where: {
        status: { [Op.in]: ['INIT', 'RETRY_PENDING'] as PiiOutboxStatus[] },
        [Op.or]: [{ nextRetryAt: null }, { nextRetryAt: { [Op.lte]: new Date() } }],
      },
      order: [['id', 'ASC']],
      limit,
    })
  }

  async markRequested(outboxId: number): Promise<void> {
    const outbox = await this.piiOutboxRepository.findById(outboxId)
    if (!outbox) {
      return
    }

    await this.piiOutboxRepository.update(
      {
        status: 'REQUESTED',
        requestCount: outbox.requestCount + 1,
        lastError: null,
      },
      { id: outboxId },
    )
  }

  async markPublishFailed(outboxId: number, error: string, requestCount: number): Promise<void> {
    const reachedMaxRetries = requestCount >= AppConfig.outbox.maxRetries
    await this.piiOutboxRepository.update(
      {
        status: reachedMaxRetries ? 'DLQ' : 'RETRY_PENDING',
        requestCount,
        lastError: error,
        nextRetryAt: reachedMaxRetries ? null : addSeconds(new Date(), requestCount * 5),
      },
      { id: outboxId },
    )
  }

  async markCompleted(idempotencyKey: string, piiId: string): Promise<PiiOutbox | null> {
    const outbox = await this.findByIdempotencyKey(idempotencyKey)
    if (!outbox) {
      return null
    }

    await this.piiOutboxRepository.update(
      {
        status: 'COMPLETED',
        piiId,
        completedAt: new Date(),
        lastError: null,
        nextRetryAt: null,
      },
      { id: outbox.id },
    )

    return this.piiOutboxRepository.findById(outbox.id)
  }

  async markFailed(idempotencyKey: string, error: string, retryable: boolean): Promise<PiiOutbox | null> {
    const outbox = await this.findByIdempotencyKey(idempotencyKey)
    if (!outbox) {
      return null
    }

    const nextCount = outbox.requestCount + 1
    const reachedMaxRetries = nextCount >= AppConfig.outbox.maxRetries
    await this.piiOutboxRepository.update(
      {
        status: retryable ? (reachedMaxRetries ? 'DLQ' : 'RETRY_PENDING') : 'FAILED',
        requestCount: nextCount,
        lastError: error,
        nextRetryAt: retryable && !reachedMaxRetries ? addSeconds(new Date(), nextCount * 5) : null,
      },
      { id: outbox.id },
    )

    return this.piiOutboxRepository.findById(outbox.id)
  }

  async requeue(outboxId: number): Promise<void> {
    await this.piiOutboxRepository.update(
      {
        status: 'INIT',
        lastError: null,
        nextRetryAt: null,
      },
      { id: outboxId },
    )
  }
}
