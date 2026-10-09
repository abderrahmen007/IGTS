import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS: explicit list in production (CORS_ORIGINS). In development, any
  // local address is accepted (localhost, 127.0.0.1 or the Mac's LAN IP), so
  // opening the app through a different host name does not break the API.
  const configured = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isProd = process.env.NODE_ENV === 'production';
  const localDev = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || configured.includes(origin) || (!isProd && localDev.test(origin))) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('IGTS Veille Réglementaire API')
    .setDescription(
      'Documentation officielle des API IGTS Veille (Administration, Entreprises, Chatbot IA, Scraper JORT)',
    )
    .setVersion('2.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Entrez votre token JWT (obtenu via /api/auth/company/login ou /api/auth/admin/login)',
      },
      'JWT-auth',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'IGTS Veille 2.0 — API Swagger',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
    },
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`IGTS Veille API → http://localhost:${port}/api`);
  console.log(`Swagger Docs    → http://localhost:${port}/api/docs`);
}
void bootstrap();
