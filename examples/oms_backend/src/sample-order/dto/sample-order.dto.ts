import { Type } from 'class-transformer'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator'

export class CreateSampleOrderDto {
  @ApiProperty({ example: 'SAMPLE-ORD-0001' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(40)
  orderNo: string

  @ApiProperty({ example: '홍길동' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  recipientName: string

  @ApiProperty({ example: '010-1234-5678' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  recipientPhonePrimary: string

  @ApiPropertyOptional({ example: 'KR', default: 'KR' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  recipientCountry?: string

  @ApiProperty({ example: '서울시 강남구 테헤란로 123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  recipientFullAddress: string

  @ApiPropertyOptional({ example: '06236' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  recipientPostalCode?: string

  @ApiPropertyOptional({ example: '문 앞에 두세요' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryMessage?: string
}

export class SeedTemplateDto {
  @ApiProperty({ example: '테스트 수령인' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  recipientName: string

  @ApiProperty({ example: '010-9999-0000' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  recipientPhonePrimary: string

  @ApiPropertyOptional({ example: 'KR', default: 'KR' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  recipientCountry?: string

  @ApiProperty({ example: '서울시 강남구 테헤란로' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  recipientFullAddress: string

  @ApiPropertyOptional({ example: '06236' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  recipientPostalCode?: string

  @ApiPropertyOptional({ example: '부재 시 경비실' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryMessage?: string
}

export class SeedSampleOrdersDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 100 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  count: number

  @ApiProperty({ example: 'SEED-ORD' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  orderNoPrefix: string

  @ApiProperty({ type: SeedTemplateDto })
  @ValidateNested()
  @Type(() => SeedTemplateDto)
  template: SeedTemplateDto
}

export class SearchSampleOrderDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  orderNo?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  piiId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sourceTag?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  recipientName?: string
}
