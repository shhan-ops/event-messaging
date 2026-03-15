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

export type PiiOutboxStatus =
  | 'INIT'
  | 'REQUESTED'
  | 'COMPLETED'
  | 'FAILED'
  | 'RETRY_PENDING'
  | 'DLQ'

@Table({ tableName: 'pii_outboxes', underscored: true, timestamps: true })
export class PiiOutbox extends Model {
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number

  @Unique
  @Column(DataType.STRING(120))
  declare idempotencyKey: string

  @Column(DataType.STRING(50))
  declare sourceTable: string

  @Column(DataType.INTEGER)
  declare sourceId: number

  @Default('INIT')
  @Column(DataType.STRING(30))
  declare status: PiiOutboxStatus

  @Column(DataType.JSON)
  declare eventPayload: Record<string, unknown>

  @AllowNull(true)
  @Column(DataType.UUID)
  declare piiId?: string | null

  @Default(0)
  @Column(DataType.INTEGER)
  declare requestCount: number

  @AllowNull(true)
  @Column(DataType.TEXT)
  declare lastError?: string | null

  @AllowNull(true)
  @Column(DataType.DATE)
  declare nextRetryAt?: Date | null

  @AllowNull(true)
  @Column(DataType.DATE)
  declare completedAt?: Date | null

  @CreatedAt
  @Column(DataType.DATE)
  declare createdAt: Date

  @UpdatedAt
  @Column(DataType.DATE)
  declare updatedAt: Date
}
