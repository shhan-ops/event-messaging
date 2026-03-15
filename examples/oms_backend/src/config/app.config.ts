function toBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value == null) {
    return defaultValue
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const AppConfig = {
  port: Number(process.env.OMS_BACKEND_PORT || process.env.PORT || 3001),
  useSwagger: toBoolean(process.env.OMS_BACKEND_USE_SWAGGER, true),
  redisUrl: process.env.OMS_BACKEND_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  serviceName: 'oms_backend',
  database: {
    host: process.env.OMS_BACKEND_DB_HOST || '127.0.0.1',
    port: Number(process.env.OMS_BACKEND_DB_PORT || 5432),
    username: process.env.OMS_BACKEND_DB_USER || 'postgres',
    password: process.env.OMS_BACKEND_DB_PASSWORD || 'postgres',
    database: process.env.OMS_BACKEND_DB_NAME || 'oms_backend',
    schema: process.env.OMS_BACKEND_DB_SCHEMA || 'public',
    ssl: toBoolean(process.env.OMS_BACKEND_DB_SSL, false),
  },
  outbox: {
    batchSize: Number(process.env.OMS_BACKEND_OUTBOX_BATCH_SIZE || 20),
    maxRetries: Number(process.env.OMS_BACKEND_OUTBOX_MAX_RETRIES || 5),
  },
  streams: {
    request: 'PII:CREATE:REQ',
    created: 'PII:CREATED:OMS',
    failed: 'PII:FAILED:EVT',
    responseGroup: process.env.OMS_BACKEND_PII_RESPONSE_GROUP || 'CG_OMS',
    responseConsumer: process.env.OMS_BACKEND_PII_RESPONSE_CONSUMER || 'oms_backend',
  },
} as const
