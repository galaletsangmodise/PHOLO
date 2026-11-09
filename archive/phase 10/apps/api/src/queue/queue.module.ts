import { Module } from '@nestjs/common';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

/** OP5 list the Queue, OP6 call next patient, OP8 mark as left (Phase 6). */
@Module({ controllers: [QueueController], providers: [QueueService] })
export class QueueModule {}
