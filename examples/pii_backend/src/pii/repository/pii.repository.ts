import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/sequelize'
import { FindAndCountOptions, FindOptions, WhereOptions } from 'sequelize'
import { Pii } from '../model/pii.model'

@Injectable()
export class PiiRepository {
  constructor(
    @InjectModel(Pii)
    private readonly piiModel: typeof Pii,
  ) {}

  findOne(where: WhereOptions<Pii>) {
    return this.piiModel.findOne({ where })
  }

  findById(piiId: string) {
    return this.piiModel.findByPk(piiId)
  }

  create(payload: Partial<Pii>) {
    return this.piiModel.create(payload)
  }

  findAll(options?: FindOptions<Pii>) {
    return this.piiModel.findAll(options)
  }
}
