import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  SEED_EMAILS, SEED_FACILITY, TEST_PASSWORD, admin, anon, createAccount, createApp, unique,
} from './helpers';

const WRONG = 'Email or password is not correct. Try again.';
const LOCKED = 'Too many tries. Wait 60 seconds and try again.';
const SESSION_ENDED = 'Your session has ended. Please log in again.';

let app: INestApplication;
beforeAll(async () => { app = await createApp(); });
afterAll(async () => { await app.close(); });

const login = (email: string, password: string) => request(app.getHttpServer()).post('/auth/login').send({ email, password });
const me = (token?: string) => {
  const call = request(app.getHttpServer()).get('/auth/me');
  return token ? call.set('Authorization', `Bearer ${token}`) : call;
};

describe('OP1 log in', () => {
  it('T-US11-1 Clinical logs in and gets a session and the role', async () => {
    const res = await login(SEED_EMAILS.Clinical, TEST_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.session.access_token).toEqual(expect.any(String));
    expect(res.body.session.refresh_token).toEqual(expect.any(String));
    expect(res.body.profile).toEqual({ role: 'Clinical', full_name: 'Nomsa Khumalo', facility_name: 'Ubuntu Community Clinic' });
  });

  it('T-US11-2 a wrong password gives the exact message', async () => {
    const res = await login(SEED_EMAILS.Reception, 'not-the-password-1');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(WRONG);
  });

  it('T-US11-3 / T-BR12-4 after 5 wrong passwords a 6th try is refused for 60 seconds, a different email is not affected', async () => {
    const [target, other] = await Promise.all([createAccount('Reception'), createAccount('Reception')]);
    for (let i = 0; i < 5; i += 1) expect((await login(target.email, 'wrong-password-1')).status).toBe(401);
    const sixth = await login(target.email, TEST_PASSWORD); // even the right password is refused
    expect(sixth.status).toBe(429);
    expect(sixth.body.message).toBe(LOCKED);
    expect((await login(other.email, TEST_PASSWORD)).status).toBe(200);
  });

  it('T-BR12-3 4 wrong passwords then the right one logs in and resets the count', async () => {
    const account = await createAccount('Reception');
    for (let i = 0; i < 4; i += 1) await login(account.email, 'wrong-password-1');
    expect((await login(account.email, TEST_PASSWORD)).status).toBe(200);
    for (let i = 0; i < 4; i += 1) expect((await login(account.email, 'wrong-password-1')).status).toBe(401);
  });

  it('T-AUTH-2 an email with no account cannot log in', async () => {
    const res = await login(`nobody.${unique()}@test.example`, TEST_PASSWORD);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe(WRONG);
  });

  it('T-AUTH-5 an administrator-created account logs in with no email or phone verification', async () => {
    const account = await createAccount('Manager');
    const res = await login(account.email, TEST_PASSWORD);
    expect(res.status).toBe(200);
  });
});

describe('Supabase Auth settings', () => {
  it('T-AUTH-1 a self sign-up is refused', async () => {
    const { data, error } = await anon().auth.signUp({ email: `self.${unique()}@test.example`, password: TEST_PASSWORD });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  it('T-AUTH-3 a password under 10 characters, or without a letter, or without a number is refused; a valid one is accepted', async () => {
    const make = (password: string) => admin.auth.admin.createUser({ email: `pw.${unique()}@test.example`, password, email_confirm: true });
    expect((await make('Short1a')).error).not.toBeNull();
    expect((await make('1234567890')).error).not.toBeNull();
    expect((await make('abcdefghijkl')).error).not.toBeNull();
    const valid = await make('GoodPassword12');
    expect(valid.error).toBeNull();
    if (valid.data.user) await admin.auth.admin.deleteUser(valid.data.user.id);
  });

  it('T-AUTH-11 a logged-in user cannot change their own email or phone', async () => {
    const account = await createAccount('Reception');
    const client = anon();
    await client.auth.signInWithPassword({ email: account.email, password: TEST_PASSWORD });
    const newEmail = `changed.${unique()}@test.example`;
    const result = await client.auth.updateUser({ email: newEmail });
    const { data } = await admin.auth.admin.getUserById(account.id);
    // Refused, or at least not applied (see docs/PHASE-3-PROGRESS.md, decision about Section 18 #9)
    expect(result.error !== null || data.user?.email === account.email).toBe(true);
    const phone = await client.auth.updateUser({ phone: '+27825550199' });
    const after = await admin.auth.admin.getUserById(account.id);
    expect(phone.error !== null || !after.data.user?.phone).toBe(true);
  });
});

describe('OP3 read my profile and Facility name', () => {
  it.each(Object.entries(SEED_EMAILS))('T-INT-1 %s gets role, full_name and Facility name', async (role, email) => {
    const token = (await login(email, TEST_PASSWORD)).body.session.access_token;
    const res = await me(token);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(role);
    expect(res.body.full_name).toEqual(expect.any(String));
    expect(res.body.facility_name).toBe('Ubuntu Community Clinic');
  });

  it('T-INT-9 a missing or expired token gets the session message', async () => {
    for (const token of [undefined, 'not-a-token', 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjF9.invalid']) {
      const res = await me(token);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe(SESSION_ENDED);
    }
  });
});

describe('Disabled accounts (T-AUTH-10)', () => {
  it('cannot log in or call the API, and the name stays on past Visits and AuditLog rows', async () => {
    const account = await createAccount('Clinical', 'Dr Past Staff');
    const token = (await login(account.email, TEST_PASSWORD)).body.session.access_token;
    expect((await me(token)).status).toBe(200);

    const patient = await admin.from('patients').insert({ facility_id: SEED_FACILITY, first_name: 'Old', surname: 'Record', date_of_birth: '1990-01-01' }).select('id').single();
    const visit = await admin.from('visits').insert({
      facility_id: SEED_FACILITY, patient_id: patient.data!.id, queue_number: 900 + Math.floor(Math.random() * 90000), reason_category: 'Test or screening',
      consent_given: true, status: 'Called', called_by: account.id, called_at: new Date().toISOString(),
    }).select('id, called_by').single();
    await admin.rpc('write_audit', { p_facility_id: SEED_FACILITY, p_actor_id: account.id, p_action: 'called_next', p_entity_type: 'Visit', p_entity_id: visit.data!.id });

    await admin.from('staff_profiles').update({ active: false }).eq('id', account.id);
    expect((await login(account.email, TEST_PASSWORD)).status).toBe(401);
    const refused = await me(token);
    expect(refused.status).toBe(401);
    expect(refused.body.message).toBe(SESSION_ENDED);

    const profile = await admin.from('staff_profiles').select('full_name').eq('id', account.id).single();
    expect(profile.data?.full_name).toBe('Dr Past Staff');
    expect((await admin.from('visits').select('called_by').eq('id', visit.data!.id).single()).data?.called_by).toBe(account.id);
    expect((await admin.from('audit_logs').select('actor_id').eq('entity_id', visit.data!.id)).data?.[0].actor_id).toBe(account.id);
  });
});
