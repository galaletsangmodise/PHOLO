import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SEED_EMAILS, TEST_PASSWORD, admin, closeVisitsOf, createAccount, createApp, lettersName, signedInClient } from './helpers';

const NOT_ALLOWED = 'You are not allowed to open this page.';
const SESSION_ENDED = 'Your session has ended. Please log in again.';

let app: INestApplication;
beforeAll(async () => { app = await createApp(); });
afterAll(async () => { await app.close(); });

const server = () => app.getHttpServer();
const tokenFor = async (email: string): Promise<string> => (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;

describe('Role guard (T-SEC-26a, T-SEC-26b, OP1 to OP3)', () => {
  it.each(Object.entries(SEED_EMAILS))('T-SEC-26a OP3 answers %s with its own role', async (role, email) => {
    const res = await request(server()).get('/auth/me').set('Authorization', `Bearer ${await tokenFor(email)}`);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe(role);
  });

  it('the role guard answers "You are not allowed to open this page." for a role that is not allowed', async () => {
    for (const role of ['Check-in', 'Reception', 'Clinical'] as const) {
      const res = await request(server()).get('/test-roles/manager-only').set('Authorization', `Bearer ${await tokenFor(SEED_EMAILS[role])}`);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(NOT_ALLOWED);
    }
    const ok = await request(server()).get('/test-roles/manager-only').set('Authorization', `Bearer ${await tokenFor(SEED_EMAILS.Manager)}`);
    expect(ok.status).toBe(200);
  });

  it('a route with no role list lets every logged-in role in but not a visitor', async () => {
    for (const email of Object.values(SEED_EMAILS)) {
      expect((await request(server()).get('/test-roles/any-user').set('Authorization', `Bearer ${await tokenFor(email)}`)).status).toBe(200);
    }
    expect((await request(server()).get('/test-roles/any-user')).status).toBe(401);
  });

  it('T-SEC-26b a disabled account is refused by OP1, OP3 and the role guard', async () => {
    const account = await createAccount('Manager');
    const token = await tokenFor(account.email);
    await admin.from('staff_profiles').update({ active: false }).eq('id', account.id);

    expect((await request(server()).post('/auth/login').send({ email: account.email, password: TEST_PASSWORD })).status).toBe(401);
    const profile = await request(server()).get('/auth/me').set('Authorization', `Bearer ${token}`);
    expect(profile.status).toBe(401);
    expect(profile.body.message).toBe(SESSION_ENDED);
    const guarded = await request(server()).get('/test-roles/manager-only').set('Authorization', `Bearer ${token}`);
    expect(guarded.status).toBe(401);
    expect(guarded.body.message).toBe(SESSION_ENDED);
  });
});

describe('OP4 roles (T-SEC-21a, T-SEC-21b)', () => {
  const body = () => ({
    first_name: lettersName('Roleperson'),
    surname: lettersName('Roletest'),
    date_of_birth: '1990-01-01',
    id_number: null,
    cellphone: null,
    has_file: false,
    assisted: false,
    reason_category: 'Test or screening',
    urgent: false,
    consent_given: true,
  });

  it('T-SEC-21a OP4 succeeds for the Check-in role', async () => {
    const person = body();
    const res = await request(server()).post('/checkin').set('Authorization', `Bearer ${await tokenFor(SEED_EMAILS['Check-in'])}`).send(person);
    expect(res.status).toBe(200);
    const { data } = await admin.from('patients').select('id').eq('first_name', person.first_name).single();
    await closeVisitsOf(data ? [data.id] : []);
  });

  it.each(['Reception', 'Clinical', 'Manager'] as const)('T-SEC-21a OP4 is refused for %s with "You are not allowed to open this page."', async (role) => {
    const person = body();
    const res = await request(server()).post('/checkin').set('Authorization', `Bearer ${await tokenFor(SEED_EMAILS[role])}`).send(person);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(NOT_ALLOWED);
    const { count } = await admin.from('patients').select('id', { count: 'exact', head: true }).eq('first_name', person.first_name);
    expect(count).toBe(0);
  });

  it('T-SEC-21b the Check-in account cannot read Patients, Visits or the Queue', async () => {
    const client = await signedInClient(SEED_EMAILS['Check-in']);
    for (const table of ['patients', 'visits', 'visits_for_reception']) {
      const { data, error } = await client.from(table).select('*').limit(5);
      expect(error === null ? data : []).toEqual([]);
    }
  });
});
