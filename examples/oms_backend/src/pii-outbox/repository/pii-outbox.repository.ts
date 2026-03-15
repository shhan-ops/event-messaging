import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { FindOptions, Transaction, WhereOptions } from 'sequelize'
import { PiiOutbox } from '../model/pii-outbox.model'

@Injectable()
export class PiiOutboxRepository {
  constructor(
    @InjectModel(PiiOutbox)
    private readonly piiOutboxModel: typeof PiiOutbox,
  ) {}

  create(payload: Partial<PiiOutbox>, transaction: Transaction) {
    return this.piiOutboxModel.create(payload, { transaction })
  }

  findOne(where: WhereOptions<PiiOutbox>, options?: Omit<FindOptions<PiiOutbox>, 'where'>) {
    return this.piiOutboxModel.findOne({
      where,
      ...options,
    })
  }

  findAll(options: FindOptions<PiiOutbox>) {
    return this.piiOutboxModel.findAll(options)
  }

  update(values: Partial<PiiOutbox>, where: WhereOptions<PiiOutbox>) {
    return this.piiOutboxModel.update(values, { where })
  }

  findById(id: number) {
    return this.piiOutboxModel.findByPk(id)
  }
}
