import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

/** Test-only password of PRD 10.4. It is used for the seeded test accounts and the accounts these tests create. */
export const TEST_PASSWORD = 'PholoTest-2026';

export const SEED = {
  facility: '00000000-0000-4000-8000-000000000001',
  tablet: '00000000-0000-4000-8000-0000000000a1',
  reception: '00000000-0000-4000-8000-0000000000a2',
  clinical: '00000000-0000-4000-8000-0000000000a3',
  manager: '00000000-0000-4000-8000-0000000000a4',
  joseph: '00000000-0000-4000-8000-0000000000b1',
  sipho: '00000000-0000-4000-8000-0000000000b2',
  thandi: '00000000-0000-4000-8000-0000000000b3',
  palesa: '00000000-0000-4000-8000-0000000000b4',
  visit1: '00000000-0000-4000-8000-0000000000c1',
  visit2: '00000000-0000-4000-8000-0000000000c2',
  visit3: '00000000-0000-4000-8000-0000000000c3',
  visit4: '00000000-0000-4000-8000-0000000000c4',
} as const;

export const SEED_EMAILS = {
  tablet: 'tablet1@ubuntu-clinic.example',
  reception: 'busisiwe.naidoo@ubuntu-clinic.example',
  clinical: 'nomsa.khumalo@ubuntu-clinic.example',
  manager: 'farouk.patel@ubuntu-clinic.example',
} as const;

export type Role = 'Check-in' | 'Reception' | 'Clinical' | 'Manager';

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set in the root .env file.`);
  return value;
}

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** The service role stands for the administrator and the API. Allowed here because this is a test (Section 4.1). */
export const admin: SupabaseClient = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), options);

export async function signIn(email: string, password: string = TEST_PASSWORD): Promise<SupabaseClient> {
  const client = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), options);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Could not sign in ${email}: ${error.message}`);
  return client;
}

export function signInSeed(role: keyof typeof SEED_EMAILS): Promise<SupabaseClient> {
  return signIn(SEED_EMAILS[role]);
}

export const unique = (): string => randomUUID().replace(/-/g, '').slice(0, 12);

export async function createFacility(): Promise<string> {
  const { data, error } = await admin
    .from('facilities')
    .insert({ name: `Test Clinic ${unique()}`, address: '1 Test Street', province: 'Gauteng' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export interface TestAccount {
  id: string;
  email: string;
  role: Role;
  client: SupabaseClient;
}

export async function createStaff(facilityId: string, role: Role, fullName = `Test ${role}`): Promise<TestAccount> {
  const email = `${role.toLowerCase()}.${unique()}@test.example`;
  const created = await admin.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? 'No user');
  const id = created.data.user.id;
  const { error } = await admin.from('staff_profiles').insert({ id, facility_id: facilityId, full_name: fullName, role });
  if (error) throw new Error(error.message);
  return { id, email, role, client: await signIn(email) };
}

export interface TestClinic {
  facilityId: string;
  tablet: TestAccount;
  reception: TestAccount;
  clinical: TestAccount;
  manager: TestAccount;
}

/** A fresh Facility with one account per role, so each test has its own queue (visits and the audit log cannot be deleted). */
export async function createClinic(): Promise<TestClinic> {
  const facilityId = await createFacility();
  const [tablet, reception, clinical, manager] = await Promise.all([
    createStaff(facilityId, 'Check-in'),
    createStaff(facilityId, 'Reception'),
    createStaff(facilityId, 'Clinical'),
    createStaff(facilityId, 'Manager'),
  ]);
  return { facilityId, tablet, reception, clinical, manager };
}

/** South African ID number for a date of birth (YYYY-MM-DD) with a correct check digit. */
export function buildSaId(dateOfBirth: string, serial = '5000'): string {
  const base = `${dateOfBirth.slice(2, 4)}${dateOfBirth.slice(5, 7)}${dateOfBirth.slice(8, 10)}${serial}08`;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    let digit = Number(base[11 - i]);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return `${base}${(10 - (sum % 10)) % 10}`;
}

export interface PatientInput {
  first_name?: string;
  surname?: string;
  date_of_birth?: string;
  id_number?: string | null;
  cellphone?: string | null;
  [key: string]: unknown;
}

export async function insertPatient(facilityId: string, input: PatientInput = {}) {
  return admin
    .from('patients')
    .insert({ facility_id: facilityId, first_name: 'Test', surname: `Patient${unique()}`.replace(/[0-9]/g, 'x'), date_of_birth: '1990-01-01', ...input })
    .select()
    .single();
}

export async function mustInsertPatient(facilityId: string, input: PatientInput = {}) {
  const { data, error } = await insertPatient(facilityId, input);
  if (error) throw new Error(error.message);
  return data as { id: string; file_number: string };
}

/** Inserts a Visit as the administrator (the only way to place Visits at chosen times in a test). */
export async function insertVisit(facilityId: string, patientId: string, queueNumber: number, input: Record<string, unknown> = {}) {
  return admin
    .from('visits')
    .insert({
      facility_id: facilityId,
      patient_id: patientId,
      queue_number: queueNumber,
      reason_category: 'Test or screening',
      consent_given: true,
      ...input,
    })
    .select()
    .single();
}

export async function mustInsertVisit(facilityId: string, patientId: string, queueNumber: number, input: Record<string, unknown> = {}) {
  const { data, error } = await insertVisit(facilityId, patientId, queueNumber, input);
  if (error) throw new Error(error.message);
  return data as { id: string; queue_number: number; status: string };
}

export const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString();

/** Calls checkin as the API would (service role). */
export function checkin(tabletId: string, input: Record<string, unknown> = {}) {
  return admin.rpc('checkin', {
    p_tablet_id: tabletId,
    p_first_name: 'Anele',
    p_surname: 'Zulu',
    p_date_of_birth: '1992-02-02',
    p_id_number: null,
    p_cellphone: null,
    p_has_file: false,
    p_assisted: false,
    p_reason_category: 'Test or screening',
    p_urgent: false,
    p_consent_given: true,
    ...input,
  });
}

export async function catalog(): Promise<{
  tables: { name: string; rls: boolean; policies: number }[];
  indexes: { table: string; name: string; def: string }[];
  columns: { table: string; column: string; type: string }[];
}> {
  const { data, error } = await admin.rpc('test_catalog');
  if (error) throw new Error(error.message);
  return data;
}
