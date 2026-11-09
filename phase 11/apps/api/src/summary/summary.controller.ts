import { Controller, Get, Req } from '@nestjs/common';
import type { SummaryResponse } from '@pholo/types';
import type { AuthedRequest } from '../auth/auth.guard';
import { Authenticated, Roles } from '../auth/roles.decorator';
import { SummaryService } from './summary.service';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summary: SummaryService) {}

  /** OP17 Daily summary. Manager only (SEC12, SEC22). */
  @Get()
  @Authenticated()
  @Roles('Manager')
  get(@Req() request: AuthedRequest): Promise<SummaryResponse> {
    return this.summary.get(request.user!);
  }
}
