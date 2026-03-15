import { Module, forwardRef } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { PiiOutboxModule } from '@/pii-outbox/pii-outbox.module'
import { SampleOrderController } from './sample-order.controller'
import { SampleOrder } from './model/sample-order.model'
import { SampleOrderRepository } from './repository/sample-order.repository'
import { SampleOrderService } from './sample-order.service'

@Module({
  imports: [SequelizeModule.forFeature([SampleOrder]), forwardRef(() => PiiOutboxModule)],
  controllers: [SampleOrderController],
  providers: [SampleOrderRepository, SampleOrderService],
  exports: [SampleOrderService],
})
export class SampleOrderModule {}
