import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

/** OP7 start consultation, OP14 get Visit, OP15 save draft, OP16 complete visit (Phase 7). */
@Module({ controllers: [VisitsController], providers: [VisitsService] })
export class VisitsModule {}
