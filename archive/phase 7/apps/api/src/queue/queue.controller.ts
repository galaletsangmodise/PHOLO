import { Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import type { CallNextResponse, QueueResponse } from '@pholo/types';
import type { AuthedRequest } from '../auth/auth.guard';
import { Authenticated, Roles } from '../auth/roles.decorator';
import { QueueService } from './queue.service';

@Controller('queue')
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  /** OP5 List the Queue ("Active" or "Done today"). Reception and Clinical (SEC24). */
  @Get()
  @Authenticated()
  @Roles('Reception', 'Clinical')
  list(@Req() request: AuthedRequest, @Query('tab') tab?: string): Promise<QueueResponse> {
    return this.queue.list(request.user!, tab === 'done' ? 'done' : 'active');
  }

  /** OP6 Call next patient. Clinical only (SEC23). */
  @Post('call-next')
  @HttpCode(200)
  @Authenticated()
  @Roles('Clinical')
  callNext(@Req() request: AuthedRequest): Promise<CallNextResponse> {
    return this.queue.callNext(request.user!);
  }

  /** OP8 Mark as left. Reception and Clinical (SEC15, SEC24). */
  @Post(':id/left')
  @HttpCode(200)
  @Authenticated()
  @Roles('Reception', 'Clinical')
  markLeft(@Req() request: AuthedRequest, @Param('id') id: string): Promise<{ status: 'Left' }> {
    return this.queue.markLeft(request.user!, id);
  }
}
