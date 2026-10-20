import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { DjsController } from './djs.controller';
import { DjsService } from './djs.service';

@Module({
  controllers: [DjsController],
  providers: [DjsService, PrismaService],
  exports: [DjsService],
})
export class DjsModule { }
