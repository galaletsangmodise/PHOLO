import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthedRequest } from './auth.guard';
import type { ProfileResponse } from './auth.types';
import { Authenticated } from './roles.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** OP1 Log in */
  @Post('login')
  @HttpCode(200)
  login(@Body() body: { email?: unknown; password?: unknown } | undefined) {
    return this.auth.login(body?.email, body?.password);
  }

  /** OP3 Read my profile and Facility name */
  @Get('me')
  @Authenticated()
  me(@Req() request: AuthedRequest): ProfileResponse {
    const user = request.user!;
    return { role: user.role, full_name: user.fullName, facility_name: user.facilityName };
  }
}
