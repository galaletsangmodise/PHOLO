import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { AuthedRequest } from '../auth/auth.guard';
import { Authenticated, Roles } from '../auth/roles.decorator';
import { CheckinService, type CheckinResponse } from './checkin.service';

@Controller('checkin')
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  /** OP4 Check in a Patient. Only the Check-in role (SEC21). */
  @Post()
  @HttpCode(200)
  @Authenticated()
  @Roles('Check-in')
  checkIn(@Req() request: AuthedRequest, @Body() body: unknown): Promise<CheckinResponse> {
    return this.checkin.checkIn(request.user!, body);
  }
}
