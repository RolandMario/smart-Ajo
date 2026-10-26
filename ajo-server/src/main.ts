import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    // Expose raw body on req.rawBody so WebhookController can verify
    // the Paystack HMAC signature without re-serializing JSON.
    rawBody: true,
  });

  app.use(
    express.json({
      verify: (req: express.Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Tighten to specific origins before production.
  app.enableCors();

  const configService = app.get(ConfigService);
  // 5010 is the documented dev port (see .env.example and ajo-mobile/.env).
  // Keep the fallback in sync — 3000 collides with ajo-admin-web's Next dev
  // server, and a mobile app pointing at :5010 then fails every request with
  // an opaque "Request failed (0)".
  const port = configService.get<number>('PORT') ?? 5010;

  try {
    await app.listen(port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE') {
      logger.error(
        `Port ${port} is already in use. Stop the process using it (lsof -nP -iTCP:${port} -sTCP:LISTEN) or set PORT in ajo-server/.env to a free port.`,
      );
      process.exit(1);
    }
    throw error;
  }

  logger.log(`ajo-server listening on http://localhost:${port}`);
}

void bootstrap();
