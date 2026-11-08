import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import type { StaffRole } from './auth.types';
import { RolesGuard } from './roles.guard';

export const ROLES_KEY = 'pholo:roles';

/** The roles that may call an operation. Leave it out to let any logged-in role in. */
export const Roles = (...roles: StaffRole[]) => SetMetadata(ROLES_KEY, roles);

/** Token check, then role check (SEC21 to SEC26). Put it on every operation. */
export const Authenticated = () => applyDecorators(UseGuards(AuthGuard, RolesGuard));
