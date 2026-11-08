import { Module } from '@nestjs/common';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

/** OP9 to OP12: search, open, create and edit a Patient File. Paper file history (OP13) is added in Phase 9. */
@Module({ controllers: [PatientsController], providers: [PatientsService] })
export class PatientsModule {}
