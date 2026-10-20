/**
 * Standalone YouTube-sync worker.
 *
 *   node apps/api/dist/workers/youtube-sync.worker.js
 *
 * Mirror of the API's bootstrap (load env, validate it) without starting HTTP.
 */
import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { loadDotenv } from '../common/load-env';
import { validateEnv } from '../common/config';
import { YoutubeSyncModule } from './youtube-sync.module';
import { YoutubeSyncService } from './youtube-sync.service';

@Module({ imports: [YoutubeSyncModule] })
class WorkerModule { }

async function bootstrap() {
  loadDotenv();
  validateEnv();

  const app = await NestFactory.createApplicationContext(WorkerModule, {
    bufferLogs: true,
  });
  const log = new Logger('YoutubeSyncWorker');
  const service = app.get(YoutubeSyncService);
  const intervalMs = Number(process.env.INGEST_INTERVAL_MS ?? 15 * 60_000);

  const tick = async () => {
    try {
      const summary = await service.runOnce();
      log.log(`sync cycle: ${summary.created} new of ${summary.scanned} scanned`);
    } catch (err) {
      log.error('sync cycle failed', err as Error);
    }
  };

  await tick();
  setInterval(() => void tick(), intervalMs);
  log.log(`Worker running (every ${intervalMs}ms)`);

  app.enableShutdownHooks();
}

void bootstrap();
