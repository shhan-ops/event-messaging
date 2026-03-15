import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreatePiiDto {
  @ApiPropertyOptional({ example: 'OMS', default: 'OMS' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string

  @ApiProperty({ example: '홍길동' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string

  @ApiProperty({ example: '010-1234-5678' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  primaryPhone: string

  @ApiPropertyOptional({ example: 'KR', default: 'KR' })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string

  @ApiProperty({ example: '서울시 강남구 테헤란로 123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  fullAddress: string

  @ApiPropertyOptional({ example: '06236' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string

  @ApiPropertyOptional({ example: '문 앞에 두세요' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deliveryMessage?: string
}
