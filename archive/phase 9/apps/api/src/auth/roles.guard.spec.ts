import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { RolesGuard } from './roles.guard';

function context(role: string | undefined, allowed: string[] | undefined): ExecutionContext {
  const handler = () => {};
  if (allowed) Reflect.defineMetadata(ROLES_KEY, allowed, handler);
  return {
    getHandler: () => handler,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets a role that is allowed through', () => {
    expect(guard.canActivate(context('Manager', ['Manager']))).toBe(true);
  });

  it('answers "You are not allowed to open this page." for a role that is not allowed', () => {
    try {
      guard.canActivate(context('Reception', ['Manager']));
      throw new Error('should have been refused');
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(403);
      expect((error as HttpException).message).toBe('You are not allowed to open this page.');
    }
  });

  it('lets any logged-in user through when no role is listed', () => {
    expect(guard.canActivate(context('Check-in', undefined))).toBe(true);
  });
});
