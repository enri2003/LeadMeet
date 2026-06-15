import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const dataSource = app.get(DataSource);
  await dataSource.query(`UPDATE users SET role = 'Miembro' WHERE role = 'Member'`).catch(() => null);
  await dataSource.query(`UPDATE users SET is_verified = true WHERE is_verified = false`).catch(() => null);

  // ALTER TYPE ADD VALUE cannot run inside a transaction — use a raw connection
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.query(`ALTER TYPE meeting_type ADD VALUE IF NOT EXISTS 'clase'`);
  } catch {
    // already exists or not supported — safe to ignore
  } finally {
    await runner.release();
  }

  app.enableCors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type,Authorization',
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Lead Meet API')
    .setDescription('Executive meeting management platform')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
  console.log(`Lead Meet API running on: http://localhost:${process.env.PORT ?? 3000}`);
  console.log(`Swagger docs: http://localhost:${process.env.PORT ?? 3000}/api`);
}
bootstrap();
