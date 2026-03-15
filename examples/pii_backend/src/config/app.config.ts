function toBoolean(value: string | undefined, defaultValue = false): boolean {
  if (value == null) {
    return defaultValue
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

export const AppConfig = {
  port: Number(process.env.PII_BACKEND_PORT || process.env.PORT || 3002),
  useSwagger: toBoolean(process.env.PII_BACKEND_USE_SWAGGER, true),
  redisUrl: process.env.PII_BACKEND_REDIS_URL || process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  serviceName: 'pii_backend',
  database: {
    host: process.env.PII_BACKEND_DB_HOST || '127.0.0.1',
    port: Number(process.env.PII_BACKEND_DB_PORT || 5432),
    username: process.env.PII_BACKEND_DB_USER || 'postgres',
    password: process.env.PII_BACKEND_DB_PASSWORD || 'postgres',
    database: process.env.PII_BACKEND_DB_NAME || 'pii_backend',
    schema: process.env.PII_BACKEND_DB_SCHEMA || 'public',
    ssl: toBoolean(process.env.PII_BACKEND_DB_SSL, false),
  },
  streams: {
    request: 'PII:CREATE:REQ',
    created: 'PII:CREATED:OMS',
    failed: 'PII:FAILED:EVT',
    requestGroup: process.env.PII_BACKEND_REQUEST_GROUP || 'CG_PII',
    requestConsumer: process.env.PII_BACKEND_REQUEST_CONSUMER || 'pii_backend',
  },
} as const
