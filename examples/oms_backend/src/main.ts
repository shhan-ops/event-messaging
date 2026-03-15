import 'reflect-metadata'
import { Logger, ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from '@/app.module'
import { AppConfig } from '@/config/app.config'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )

  if (AppConfig.useSwagger) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('oms_backend')
        .setDescription('sample-order request sample project')
        .setVersion('1.0.0')
        .build(),
    )
    SwaggerModule.setup('docs', app, document)
  }

  await app.listen(AppConfig.port)
  Logger.log(`oms_backend listening on ${await app.getUrl()}`)
}

void bootstrap()
