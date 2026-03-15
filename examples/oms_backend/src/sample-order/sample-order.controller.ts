import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CreateSampleOrderDto, SearchSampleOrderDto, SeedSampleOrdersDto } from './dto/sample-order.dto'
import { SampleOrderService } from './sample-order.service'

@ApiTags('sample-order')
@Controller('sample-order')
export class SampleOrderController {
  constructor(private readonly sampleOrderService: SampleOrderService) {}

  @Post()
  @ApiOperation({ summary: '샘플 주문 생성 및 PII 요청 발행' })
  create(@Body() dto: CreateSampleOrderDto) {
    return this.sampleOrderService.createSampleOrder(dto)
  }

  @Post('seed')
  @ApiOperation({ summary: '샘플 주문 일괄 생성' })
  seed(@Body() dto: SeedSampleOrdersDto) {
    return this.sampleOrderService.seedSampleOrders(dto)
  }

  @Get()
  @ApiOperation({ summary: '샘플 주문 목록 조회' })
  findAll(@Query() dto: SearchSampleOrderDto) {
    return this.sampleOrderService.findSampleOrders(dto)
  }

  @Get(':id')
  @ApiOperation({ summary: '샘플 주문 단건 조회' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sampleOrderService.findSampleOrder(id)
  }

  @Post(':id/retry-pii')
  @ApiOperation({ summary: '샘플 주문 PII 요청 재발행' })
  retryPii(@Param('id', ParseIntPipe) id: number) {
    return this.sampleOrderService.retryPii(id)
  }
}
