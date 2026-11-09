import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SEED_EMAILS, TEST_PASSWORD, admin, createAccount, createApp } from './helpers';

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
