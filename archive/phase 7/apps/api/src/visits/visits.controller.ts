import { Body, Controller, Get, HttpCode, Param, Post, Put, Req } from '@nestjs/common';
import type { VisitDetailResponse } from '@pholo/types';
import type { AuthedRequest } from '../auth/auth.guard';
import { Authenticated, Roles } from '../auth/roles.decorator';
import { VisitsService } from './visits.service';

/** Clinical only (SEC10, SEC14, SEC16, SEC23): Reception, Check-in and Manager are refused by the role guard. */
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  /** OP14 Get Visit (for S9). */
  @Get(':id')
  @Authenticated()
  @Roles('Clinical')
  get(@Req() request: AuthedRequest, @Param('id') id: string): Promise<VisitDetailResponse> {
    return this.visits.get(request.user!, id);
  }

  /** OP7 Start consultation. */
  @Post(':id/start')
  @HttpCode(200)
  @Authenticated()
  @Roles('Clinical')
  start(@Req() request: AuthedRequest, @Param('id') id: string): Promise<{ status: 'In consultation' }> {
    return this.visits.start(request.user!, id);
  }

  /** OP15 Save draft. */
  @Put(':id/draft')
  @Authenticated()
  @Roles('Clinical')
  saveDraft(@Req() request: AuthedRequest, @Param('id') id: string, @Body() body: unknown): Promise<{ saved: true }> {
    return this.visits.saveDraft(request.user!, id, body);
  }

  /** OP16 Complete visit. */
  @Post(':id/complete')
  @HttpCode(200)
  @Authenticated()
  @Roles('Clinical')
  complete(@Req() request: AuthedRequest, @Param('id') id: string, @Body() body: unknown): Promise<{ status: 'Completed' }> {
    return this.visits.complete(request.user!, id, body);
  }
}
