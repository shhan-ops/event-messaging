import { Module } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { PiiController } from './pii.controller'
import { Pii } from './model/pii.model'
import { PiiRepository } from './repository/pii.repository'
import { PiiService } from './pii.service'

@Module({
  imports: [SequelizeModule.forFeature([Pii])],
  controllers: [PiiController],
  providers: [PiiRepository, PiiService],
  exports: [PiiService],
})
export class PiiModule {}
