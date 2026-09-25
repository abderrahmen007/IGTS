import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS so the Next.js frontend can call the API
  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  });

  // Global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix: all routes start with /api
  app.setGlobalPrefix('api');

  await app.listen(process.env.PORT ?? 3001);
  console.log(`🚀 IGTS Veille API running on http://localhost:${process.env.PORT ?? 3001}/api`);
}
bootstrap();
