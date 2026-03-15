import {
  AllowNull,
  Column,
  CreatedAt,
  DataType,
  Default,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from 'sequelize-typescript'

@Table({ tableName: 'piis', underscored: true, timestamps: true })
export class Pii extends Model {
  @PrimaryKey
  @Column({ field: 'pii_id', type: DataType.UUID })
  declare piiId: string

  @Column(DataType.STRING(50))
  declare source: string

  @Column(DataType.STRING(100))
  declare name: string

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

  @Column(DataType.STRING(64))
  declare hash: string

  @Default('ACTIVE')
  @Column(DataType.STRING(20))
  declare status: string

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date
}
