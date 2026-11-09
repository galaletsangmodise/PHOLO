import { INestApplication, Controller, Get, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
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
  configureApp(app);
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

/** A valid South African ID number (BR5) for a date of birth "YYYY-MM-DD": the Luhn check digit is worked out here. */
export function makeSaId(dateOfBirth: string, serial = '5000'): string {
  const base = `${dateOfBirth.slice(2, 4)}${dateOfBirth.slice(5, 7)}${dateOfBirth.slice(8, 10)}${serial}08`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    let value = Number(base[11 - i]);
    if (i % 2 === 0) {
      value *= 2;
      if (value > 9) value -= 9;
    }
    sum += value;
  }
  return `${base}${(10 - (sum % 10)) % 10}`;
}

/** Names only hold letters (BR: names), so a unique suffix is written with letters. */
export function lettersName(prefix: string): string {
  return `${prefix}${unique().replace(/[0-9]/g, (d) => 'ghijklmnop'[Number(d)])}`;
}

/** A client that is signed in as the account, so every read goes through Row-Level Security as that user. */
export async function signedInClient(email: string): Promise<SupabaseClient> {
  const client = anon();
  const { error } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (error) throw new Error(error.message);
  return client;
}

/** Closes Visits made by a test so they do not stay in the Queue (best effort). */
export async function closeVisitsOf(patientIds: string[]): Promise<void> {
  if (patientIds.length === 0) return;
  await admin.from('visits').update({ status: 'Left', left_at: new Date().toISOString() }).in('patient_id', patientIds).in('status', ['Waiting', 'Called']);
}

export interface TestClinic {
  facilityId: string;
  accounts: Record<Role, Account>;
}

/** Makes an account in any Facility, as the administrator would. */
export async function addAccount(facilityId: string, role: Role, fullName = `Test ${role}`): Promise<Account> {
  const email = `${role.toLowerCase().replace('-', '')}.${unique()}@test.example`;
  const created = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? 'No user');
  const profile = await admin.from('staff_profiles').insert({ id: created.data.user.id, facility_id: facilityId, full_name: fullName, role });
  if (profile.error) throw new Error(profile.error.message);
  return { id: created.data.user.id, email, role };
}

/** A fresh Facility with one account per role, so a test has its own queue (Visits and the audit log cannot be deleted). */
export async function createClinic(): Promise<TestClinic> {
  const { data, error } = await admin
    .from('facilities')
    .insert({ name: `Test Clinic ${unique()}`, address: '1 Test Street', province: 'Gauteng' })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'No facility');
  const accounts = {} as Record<Role, Account>;
  for (const role of Object.keys(SEED_EMAILS) as Role[]) accounts[role] = await addAccount(data.id, role);
  return { facilityId: data.id, accounts };
}

export const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

/** Puts a Patient and a Visit into a Facility as the administrator, at a chosen time and status. */
export async function addVisit(
  facilityId: string,
  queueNumber: number,
  fields: { firstName?: string; surname?: string; dateOfBirth?: string; urgent?: boolean; minutesAgo?: number; status?: string; [key: string]: unknown } = {},
) {
  const { firstName = lettersName('Test'), surname = lettersName('Patient'), dateOfBirth = '1990-01-01', minutesAgo: ago = 10, ...visit } = fields;
  const patient = await admin
    .from('patients')
    .insert({ facility_id: facilityId, first_name: firstName, surname, date_of_birth: dateOfBirth })
    .select('id')
    .single();
  if (patient.error || !patient.data) throw new Error(patient.error?.message ?? 'No patient');
  const row = await admin
    .from('visits')
    .insert({
      facility_id: facilityId,
      patient_id: patient.data.id,
      queue_number: queueNumber,
      reason_category: 'Test or screening',
      consent_given: true,
      checkin_at: minutesAgoIso(ago),
      ...visit,
    })
    .select('id, patient_id')
    .single();
  if (row.error || !row.data) throw new Error(row.error?.message ?? 'No visit');
  return { visitId: row.data.id as string, patientId: row.data.patient_id as string, firstName, surname };
}

function minutesAgoIso(minutes: number): string {
  return minutesAgo(minutes);
}
