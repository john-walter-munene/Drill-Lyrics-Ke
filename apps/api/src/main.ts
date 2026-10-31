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
import { MailService } from './modules/mail/mail.service';

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

  // Client-side alignment uploads raw WAV; Express only applies a parser to
  // JSON/urlencoded bodies, so this limit is imposed by the sync-estimate
  // route itself (see AdminController.estimateLyrics).


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
    exposedHeaders: ['Authorization'],
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

  // Two lines at boot that answer "why does adding an artist say YouTube is
  // not configured" and "why can I not sign in as admin" without reading the
  // compose file. Booleans and addresses only — never a secret value.
  const config = new Logger('Bootstrap');
  config.log(`YouTube Data API key: ${process.env.YOUTUBE_API_KEY ? 'configured' : 'MISSING (adding artists from YouTube will fail)'}`);
  config.log(`Admin seed account: ${process.env.SEED_ADMIN_EMAIL ?? 'admin@drillke.local'} (seeding ${process.env.SEED_ON_START === 'false' ? 'off' : 'on'}, password reset on boot: ${process.env.SEED_ADMIN_RESET_PASSWORD === 'true' ? 'yes' : 'no'})`);

  // Mail self-check, deliberately after listen and not awaited: a mailer that
  // is briefly unreachable must not stop the API serving pages. It runs so a
  // bad host or credential shows up in the deploy log rather than in a user's
  // "I never got the reset email" report.
  void app.get(MailService).verify();

  // Free-tier staging: run the YouTube metadata import inside the API process
  // instead of a dedicated worker service. Disable in production and run
  // `node dist/workers/youtube-sync.worker.js` as its own service.
  if (process.env.EMBED_WORKER === 'true') {
    const sync = app.get(YoutubeSyncService);
    const log = new Logger('EmbeddedWorker');
    if (!sync.configured()) {
      log.warn('EMBED_WORKER=true but YOUTUBE_API_KEY is unset — the sync cycle will do nothing');
    }
    const intervalMs = Number(process.env.INGEST_INTERVAL_MS ?? 15 * 60_000);
    // One cycle at a time. A stuck cycle (a very long channel on a slow API)
    // must not stack on top of the next one and multiply the work.
    let running = false;
    const tick = async () => {
      if (running) return;
      running = true;
      try {
        await sync.runOnce();
      } catch (err) {
        log.error('youtube sync cycle failed', err as Error);
      } finally {
        running = false;
      }
    };
    // Not awaited and delayed by one interval: the cycle walks every artist's
    // channel and would otherwise compete with the first page loads after a
    // deploy. An initial pass is still run shortly after boot, once the app is
    // responsive.
    setTimeout(() => void tick(), 60_000);
    setInterval(() => void tick(), intervalMs);
    log.log(`Embedded YouTube sync running (every ${intervalMs}ms)`);
  }
}

void bootstrap();
