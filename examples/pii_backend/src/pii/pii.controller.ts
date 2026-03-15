import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CreatePiiDto } from './dto/create-pii.dto'
import { PiiService } from './pii.service'

@ApiTags('pii')
@Controller('pii')
export class PiiController {
  constructor(private readonly piiService: PiiService) {}

  @Post()
  @ApiOperation({ summary: 'PII 생성 또는 재사용' })
  create(@Body() dto: CreatePiiDto) {
    return this.piiService.createOrReuse(dto)
  }

  @Get()
  @ApiOperation({ summary: '생성된 PII 목록 조회' })
  findAll() {
    return this.piiService.findAll()
  }

  @Get(':piiId')
  @ApiOperation({ summary: 'PII 단건 조회' })
  findOne(@Param('piiId') piiId: string) {
    return this.piiService.findOne(piiId)
  }
}
