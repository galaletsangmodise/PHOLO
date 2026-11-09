import { Module } from '@nestjs/common';
import { SummaryController } from './summary.controller';
import { SummaryService } from './summary.service';

/** OP17 daily summary (BR15, Phase 8). */
@Module({ controllers: [SummaryController], providers: [SummaryService] })
export class SummaryModule {}
