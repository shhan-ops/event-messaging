import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { InjectConnection } from '@nestjs/sequelize'
import { format } from 'date-fns'
import { randomUUID } from 'crypto'
import { Op } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { CreateSampleOrderDto, SearchSampleOrderDto, SeedSampleOrdersDto } from './dto/sample-order.dto'
import { SampleOrder } from './model/sample-order.model'
import { PiiOutboxService } from '@/pii-outbox/pii-outbox.service'
import { SampleOrderRepository } from './repository/sample-order.repository'

@Injectable()
export class SampleOrderService {
  private readonly logger = new Logger(SampleOrderService.name)

  constructor(
    @InjectConnection()
    private readonly sequelize: Sequelize,
    private readonly piiOutboxService: PiiOutboxService,
    private readonly sampleOrderRepository: SampleOrderRepository,
  ) {}

  async createSampleOrder(dto: CreateSampleOrderDto): Promise<SampleOrder> {
    const existing = await this.sampleOrderRepository.findOne({ orderNo: dto.orderNo })
    if (existing) {
      return existing
    }

    return this.sequelize.transaction(async (transaction) => {
      const sampleOrder = await this.sampleOrderRepository.create(
        {
          orderNo: dto.orderNo,
          customerName: dto.recipientName,
          primaryPhone: dto.recipientPhonePrimary,
          country: dto.recipientCountry || 'KR',
          fullAddress: dto.recipientFullAddress,
          postalCode: dto.recipientPostalCode,
          deliveryMessage: dto.deliveryMessage,
        },
        transaction,
      )

      const idempotencyKey = this.piiOutboxService.buildIdempotencyKey(
        {
          customerName: sampleOrder.customerName,
          primaryPhone: sampleOrder.primaryPhone,
          country: sampleOrder.country,
          fullAddress: sampleOrder.fullAddress,
          postalCode: sampleOrder.postalCode,
          deliveryMessage: sampleOrder.deliveryMessage,
        },
        'sample_orders',
        sampleOrder.sampleOrderId,
      )

      const payload = this.piiOutboxService.buildCreateEventPayload(
        {
          customerName: sampleOrder.customerName,
          primaryPhone: sampleOrder.primaryPhone,
          country: sampleOrder.country,
          fullAddress: sampleOrder.fullAddress,
          postalCode: sampleOrder.postalCode,
          deliveryMessage: sampleOrder.deliveryMessage,
        },
        {
          sourceTable: 'sample_orders',
          sourceId: sampleOrder.sampleOrderId,
          orderNo: sampleOrder.orderNo,
          traceId: randomUUID(),
        },
        idempotencyKey,
      )

      const outbox = await this.piiOutboxService.createOutbox(
        {
          idempotencyKey,
          sourceTable: 'sample_orders',
          sourceId: sampleOrder.sampleOrderId,
          payload,
        },
        transaction,
      )

      await this.sampleOrderRepository.update(
        { piiOutboxId: outbox.id },
        { sampleOrderId: sampleOrder.sampleOrderId },
        transaction,
      )

      return this.sampleOrderRepository.reload(sampleOrder.sampleOrderId, transaction) as Promise<SampleOrder>
    })
  }

  async seedSampleOrders(dto: SeedSampleOrdersDto): Promise<{ count: number; orders: SampleOrder[] }> {
    const today = format(new Date(), 'yyyyMMdd')
    const prefix = `${dto.orderNoPrefix}-${today}-`
    const count = await this.sampleOrderRepository.count({
      orderNo: {
        [Op.like]: `${prefix}%`,
      },
    })
    const orders: SampleOrder[] = []

    for (let index = 0; index < dto.count; index += 1) {
      const orderNo = `${prefix}${String(count + index + 1).padStart(4, '0')}`
      const order = await this.createSampleOrder({
        orderNo,
        recipientName: dto.template.recipientName,
        recipientPhonePrimary: dto.template.recipientPhonePrimary,
        recipientCountry: dto.template.recipientCountry,
        recipientFullAddress: dto.template.recipientFullAddress,
        recipientPostalCode: dto.template.recipientPostalCode,
        deliveryMessage: dto.template.deliveryMessage,
      })
      orders.push(order)
    }

    return { count: orders.length, orders }
  }

  async findSampleOrders(dto: SearchSampleOrderDto) {
    const page = dto.page || 1
    const limit = dto.limit || 20
    const offset = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (dto.orderNo) {
      where.orderNo = dto.orderNo
    }
    if (dto.piiId) {
      where.piiId = dto.piiId
    }
    if (dto.sourceTag) {
      where.sourceTag = dto.sourceTag
    }
    if (dto.recipientName) {
      where.customerName = dto.recipientName
    }

    const { rows, count } = await this.sampleOrderRepository.findAndCountAll({
      where,
      limit,
      offset,
      order: [['sampleOrderId', 'DESC']],
    })

    return {
      page,
      limit,
      total: count,
      items: rows,
    }
  }

  async findSampleOrder(id: number): Promise<SampleOrder> {
    const order = await this.sampleOrderRepository.findById(id)
    if (!order) {
      throw new NotFoundException(`sample order not found: ${id}`)
    }
    return order
  }

  async retryPii(id: number): Promise<SampleOrder> {
    const order = await this.findSampleOrder(id)
    if (!order.piiOutboxId) {
      return order
    }

    await this.piiOutboxService.requeue(order.piiOutboxId)
    return this.findSampleOrder(id)
  }

  async attachPiiResult(sampleOrderId: number, piiId: string): Promise<void> {
    await this.sampleOrderRepository.update({ piiId }, { sampleOrderId })
  }

  async markPiiFailed(idempotencyKey: string, error: string, retryable: boolean): Promise<void> {
    this.logger.warn(`pii failed for ${idempotencyKey}: ${error}`)
    await this.piiOutboxService.markFailed(idempotencyKey, error, retryable)
  }
}
