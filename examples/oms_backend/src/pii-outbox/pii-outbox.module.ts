import { Module, forwardRef } from '@nestjs/common'
import { SequelizeModule } from '@nestjs/sequelize'
import { PiiOutbox } from './model/pii-outbox.model'
import { PiiOutboxRepository } from './repository/pii-outbox.repository'
import { PiiOutboxService } from './pii-outbox.service'
import { PiiOutboxPublisher } from './pii-outbox.publisher'
import { PiiOutboxConsumer } from './pii-outbox.consumer'
import { SampleOrderModule } from '@/sample-order/sample-order.module'

@Module({
  imports: [SequelizeModule.forFeature([PiiOutbox]), forwardRef(() => SampleOrderModule)],
  providers: [PiiOutboxRepository, PiiOutboxService, PiiOutboxPublisher, PiiOutboxConsumer],
  exports: [PiiOutboxService],
})
export class PiiOutboxModule {}
