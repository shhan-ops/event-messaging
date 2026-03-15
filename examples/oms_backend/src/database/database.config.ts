import { SequelizeModuleOptions } from '@nestjs/sequelize'
import { Sequelize } from 'sequelize-typescript'
import { AppConfig } from '@/config/app.config'
import { omsModels } from './models'

export const omsDatabaseConfig: SequelizeModuleOptions = {
  dialect: 'postgres',
  host: AppConfig.database.host,
  port: AppConfig.database.port,
  username: AppConfig.database.username,
  password: AppConfig.database.password,
  database: AppConfig.database.database,
  schema: AppConfig.database.schema,
  dialectOptions: AppConfig.database.ssl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : undefined,
  models: omsModels,
  autoLoadModels: false,
  synchronize: false,
  logging: false,
}

export function createOmsSequelize(): Sequelize {
  return new Sequelize({
    dialect: 'postgres',
    host: AppConfig.database.host,
    port: AppConfig.database.port,
    username: AppConfig.database.username,
    password: AppConfig.database.password,
    database: AppConfig.database.database,
    schema: AppConfig.database.schema,
    dialectOptions: AppConfig.database.ssl
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : undefined,
    logging: false,
  })
}
