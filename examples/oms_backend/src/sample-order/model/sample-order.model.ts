import {
  AllowNull,
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  Unique,
  UpdatedAt,
} from 'sequelize-typescript'

@Table({ tableName: 'sample_orders', underscored: true, timestamps: true })
export class SampleOrder extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column({ field: 'sample_order_id', type: DataType.INTEGER })
  declare sampleOrderId: number

  @Unique
  @Column(DataType.STRING(40))
  declare orderNo: string

  @Column(DataType.STRING(100))
  declare customerName: string

  @Column(DataType.STRING(30))
  declare primaryPhone: string

  @Default('KR')
  @Column(DataType.STRING(2))
  declare country: string

  @Column(DataType.STRING(500))
  declare fullAddress: string

  @AllowNull(true)
  @Column(DataType.STRING(20))
  declare postalCode?: string | null

  @AllowNull(true)
  @Column(DataType.STRING(200))
  declare deliveryMessage?: string | null

  @AllowNull(true)
  @Column(DataType.UUID)
  declare piiId?: string | null

  @AllowNull(true)
  @Column(DataType.INTEGER)
  declare piiOutboxId?: number | null

  @Default('sample_seed')
  @Column(DataType.STRING(50))
  declare sourceTag: string

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date
}
