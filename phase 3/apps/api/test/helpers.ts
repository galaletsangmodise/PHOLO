import { INestApplication, Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { Authenticated, Roles } from '../src/auth/roles.decorator';

/** Test-only password of PRD 10.4 (a valid password under the Phase 3 rules). */
export const TEST_PASSWORD = 'PholoTest-2026';
export const SEED_FACILITY = '00000000-0000-4000-8000-000000000001';
export const SEED_EMAILS = {
  'Check-in': 'tablet1@ubuntu-clinic.example',
  Reception: 'busisiwe.naidoo@ubuntu-clinic.example',
  Clinical: 'nomsa.khumalo@ubuntu-clinic.example',
  Manager: 'farouk.patel@ubuntu-clinic.example',
} as const;
export type Role = keyof typeof SEED_EMAILS;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set in the root .env file.`);
  return value;
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin: SupabaseClient = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), options);
export const anon = (): SupabaseClient => createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), options);

export const unique = (): string => randomUUID().replace(/-/g, '').slice(0, 12);

/** A route that only the Manager may open: stands in for the later operations while the role guard is tested. */
@Controller('test-roles')
export class TestRolesController {
  @Get('manager-only')
  @Authenticated()
  @Roles('Manager')
  managerOnly() {
    return { ok: true };
  }

  @Get('any-user')
  @Authenticated()
  anyUser() {
    return { ok: true };
  }
}

@Module({ controllers: [TestRolesController] })
class TestRolesModule {}

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule, TestRolesModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export interface Account { id: string; email: string; role: Role }

/** Makes a new account in the seeded Facility, as the administrator would. */
export async function createAccount(role: Role, fullName = `Test ${role}`): Promise<Account> {
  const email = `${role.toLowerCase().replace('-', '')}.${unique()}@test.example`;
  const created = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? 'No user');
  const { error } = await admin.from('staff_profiles').insert({ id: created.data.user.id, facility_id: SEED_FACILITY, full_name: fullName, role });
  if (error) throw new Error(error.message);
  return { id: created.data.user.id, email, role };
}
