import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MESSAGES, type StaffRole } from './auth.types';
import type { AuthedRequest } from './auth.guard';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.reflector.getAllAndOverride<StaffRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!allowed || allowed.length === 0) return true;
    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user || !allowed.includes(user.role)) {
      throw new HttpException(MESSAGES.notAllowed, HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
