import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginLock } from './login-lock';
import { RolesGuard } from './roles.guard';
import { SupabaseService } from './supabase.service';

/** Token check, role guard and log-in (OP1, OP3). Log out (OP2) is done by the web app with Supabase Auth. */
@Global()
@Module({
  controllers: [AuthController],
  providers: [SupabaseService, { provide: LoginLock, useFactory: () => new LoginLock() }, AuthService, AuthGuard, RolesGuard],
  exports: [SupabaseService, AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
