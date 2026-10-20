import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { loadDotenv } from './common/load-env';
import { AppModule } from './app.module';
import { validateEnv } from './common/config';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { YoutubeSyncService } from './workers/youtube-sync.service';

async function bootstrap() {
  loadDotenv();
  validateEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  app.setGlobalPrefix('api');
  app.use(helmet());

  // Cap request body sizes so oversized payloads are rejected early.
  // Lyrics submissions are Markdown text, so 512kb is generous.
  const bodyLimit = process.env.MAX_BODY_SIZE ?? '512kb';
  app.useBodyParser('json', { limit: bodyLimit });
  app.useBodyParser('urlencoded', { limit: bodyLimit, extended: true });

  // CORS: allow the configured origins only (comma-separated, trailing-slash
  // and whitespace tolerant). No preview-domain wildcard — lock down by default.
  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      // Non-browser requests (curl, server-to-server) send no Origin.
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/+$/, '');
      const ok = allowedOrigins.includes(normalized);
      return callback(ok ? null : new Error('Not allowed by CORS'), ok);
    },
    credentials: true,
  });

  // Global input validation: strip unknown properties and reject payloads that
  // carry properties outside the DTO allowlist.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  new Logger('Bootstrap').log(`DrillKe API listening on :${port}`);

  // Free-tier staging: run the YouTube metadata import inside the API process
  // instead of a dedicated worker service. Disable in production and run
  // `node dist/workers/youtube-sync.worker.js` as its own service.
  if (process.env.EMBED_WORKER === 'true') {
    const sync = app.get(YoutubeSyncService);
    const intervalMs = Number(process.env.INGEST_INTERVAL_MS ?? 15 * 60_000);
    const log = new Logger('EmbeddedWorker');
    const tick = async () => {
      try {
        await sync.runOnce();
      } catch (err) {
        log.error('youtube sync cycle failed', err as Error);
      }
    };
    void tick();
    setInterval(() => void tick(), intervalMs);
    log.log(`Embedded YouTube sync running (every ${intervalMs}ms)`);
  }
}

void bootstrap();
