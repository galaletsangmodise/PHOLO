import { Module } from '@nestjs/common';
import { CheckinController } from './checkin.controller';
import { CheckinService } from './checkin.service';

/** The Check-in function (BR1 to BR6, BR14, BR17): OP4. */
@Module({ controllers: [CheckinController], providers: [CheckinService] })
export class CheckinModule {}
