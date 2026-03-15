import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { FindAndCountOptions, Transaction, WhereOptions } from 'sequelize'
import { SampleOrder } from '../model/sample-order.model'

@Injectable()
export class SampleOrderRepository {
  constructor(
    @InjectModel(SampleOrder)
    private readonly sampleOrderModel: typeof SampleOrder,
  ) {}

  findOne(where: WhereOptions<SampleOrder>) {
    return this.sampleOrderModel.findOne({ where })
  }

  findById(sampleOrderId: number) {
    return this.sampleOrderModel.findByPk(sampleOrderId)
  }

  create(payload: Partial<SampleOrder>, transaction: Transaction) {
    return this.sampleOrderModel.create(payload, { transaction })
  }

  reload(sampleOrderId: number, transaction?: Transaction) {
    return this.sampleOrderModel.findByPk(sampleOrderId, { transaction })
  }

  count(where: WhereOptions<SampleOrder>) {
    return this.sampleOrderModel.count({ where })
  }

  findAndCountAll(options: FindAndCountOptions<SampleOrder>) {
    return this.sampleOrderModel.findAndCountAll(options)
  }

  update(values: Partial<SampleOrder>, where: WhereOptions<SampleOrder>, transaction?: Transaction) {
    return this.sampleOrderModel.update(values, { where, transaction })
  }
}
