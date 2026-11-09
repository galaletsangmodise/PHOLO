import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CheckinModule } from './checkin/checkin.module';
import { PatientsModule } from './patients/patients.module';
import { QueueModule } from './queue/queue.module';
import { SummaryModule } from './summary/summary.module';
import { VisitsModule } from './visits/visits.module';

@Module({
  imports: [AuthModule, CheckinModule, PatientsModule, QueueModule, VisitsModule, SummaryModule, AuditModule],
})
export class AppModule {}
