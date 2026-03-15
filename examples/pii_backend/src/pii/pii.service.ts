import { Injectable, NotFoundException } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'
import { CreatePiiDto } from './dto/create-pii.dto'
import { PiiRepository } from './repository/pii.repository'

@Injectable()
export class PiiService {
  constructor(private readonly piiRepository: PiiRepository) {}

  async createOrReuse(dto: CreatePiiDto) {
    const normalized = this.normalize(dto)
    const existing = await this.piiRepository.findOne({
      source: normalized.source,
      hash: normalized.hash,
      status: 'ACTIVE',
    })
    if (existing) {
      return {
        piiId: existing.piiId,
        created: false,
        reused: true,
        pii: existing,
      }
    }

    const created = await this.piiRepository.create({
      piiId: randomUUID(),
      source: normalized.source,
      name: normalized.name,
      primaryPhone: normalized.primaryPhone,
      country: normalized.country,
      fullAddress: normalized.fullAddress,
      postalCode: normalized.postalCode || null,
      deliveryMessage: normalized.deliveryMessage || null,
      hash: normalized.hash,
      status: 'ACTIVE',
    })

    return {
      piiId: created.piiId,
      created: true,
      reused: false,
      pii: created,
    }
  }

  async createOrReuseFromStream(params: {
    source: string
    idempotencyKey: string
    request: Record<string, any>
  }) {
    return this.createOrReuse({
      source: params.source,
      name: params.request.name,
      primaryPhone: params.request.primaryPhone,
      country: params.request.country,
      fullAddress: params.request.fullAddress,
      postalCode: params.request.postalCode,
      deliveryMessage: params.request.deliveryMessage,
    })
  }

  findAll() {
    return this.piiRepository.findAll({
      order: [['createdAt', 'DESC']],
    })
  }

  async findOne(piiId: string) {
    const pii = await this.piiRepository.findById(piiId)
    if (!pii) {
      throw new NotFoundException(`pii not found: ${piiId}`)
    }
    return pii
  }

  private normalize(dto: CreatePiiDto): {
    source: string
    name: string
    primaryPhone: string
    country: string
    fullAddress: string
    postalCode: string
    deliveryMessage: string
    hash: string
  } {
    const normalized = {
      source: dto.source || 'OMS',
      name: dto.name.trim().replace(/\s+/g, ' '),
      primaryPhone: dto.primaryPhone.replace(/\D/g, ''),
      country: (dto.country || 'KR').trim().toUpperCase(),
      fullAddress: dto.fullAddress.trim(),
      postalCode: dto.postalCode?.trim() || '',
      deliveryMessage: dto.deliveryMessage?.trim() || '',
    }

    const hash = createHash('sha256')
      .update(
        [
          normalized.name,
          normalized.primaryPhone,
          normalized.country,
          normalized.fullAddress,
          normalized.postalCode,
          normalized.deliveryMessage,
        ].join('|'),
      )
      .digest('hex')

    return { ...normalized, hash }
  }
}
