import { HttpException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginLock } from './login-lock';
import type { SupabaseService } from './supabase.service';

const SESSION_ENDED = 'Your session has ended. Please log in again.';
const WRONG = 'Email or password is not correct. Try again.';
const LOCKED = 'Too many tries. Wait 60 seconds and try again.';
const SERVER = 'Something went wrong on our side. Please try again.';

interface Rows { staff_profiles?: unknown; facilities?: unknown }

function fakeSupabase(options: {
  signIn?: () => Promise<unknown>;
  getUser?: () => Promise<unknown>;
  rows?: Rows;
}) {
  const rows: Rows = options.rows ?? {
    staff_profiles: { id: 'u1', full_name: 'Nomsa Khumalo', role: 'Clinical', active: true, facility_id: 'f1' },
    facilities: { name: 'Ubuntu Community Clinic' },
  };
  const session = { access_token: 'tok', refresh_token: 'ref', expires_in: 3600, expires_at: 1, token_type: 'bearer' };
  const client = {
    auth: {
      signInWithPassword: jest.fn(options.signIn ?? (async () => ({ data: { session, user: { id: 'u1' } }, error: null }))),
      getUser: jest.fn(options.getUser ?? (async () => ({ data: { user: { id: 'u1' } }, error: null }))),
    },
    from: (table: keyof Rows) => {
      const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) };
      return chain;
    },
  };
  return { client, service: { anon: () => client, forToken: () => client, admin: () => client } as unknown as SupabaseService };
}

async function status(promise: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await promise;
  } catch (error) {
    const e = error as HttpException;
    return { status: e.getStatus(), message: e.message };
  }
  throw new Error('Expected the call to be refused');
}

const invalid = async () => ({ data: { session: null, user: null }, error: { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' } });

describe('AuthService.login (OP1)', () => {
  it('returns the session and the profile for correct details', async () => {
    const { service } = fakeSupabase({});
    const auth = new AuthService(service, new LoginLock());
    const result = await auth.login('nomsa.khumalo@ubuntu-clinic.example', 'a-valid-password');
    expect(result.session.access_token).toBe('tok');
    expect(result.profile).toEqual({ role: 'Clinical', full_name: 'Nomsa Khumalo', facility_name: 'Ubuntu Community Clinic' });
  });

  it('refuses wrong details with the exact message', async () => {
    const { service } = fakeSupabase({ signIn: invalid });
    const auth = new AuthService(service, new LoginLock());
    expect(await status(auth.login('a@x.co.za', 'wrong'))).toEqual({ status: 401, message: WRONG });
  });

  it('refuses a 6th try with the lock message, even with the correct password, and does not call Supabase', async () => {
    const { service, client } = fakeSupabase({ signIn: invalid });
    const auth = new AuthService(service, new LoginLock());
    for (let i = 0; i < 5; i += 1) await status(auth.login('a@x.co.za', 'wrong'));
    client.auth.signInWithPassword.mockClear();
    expect(await status(auth.login('a@x.co.za', 'a-valid-password'))).toEqual({ status: 429, message: LOCKED });
    expect(client.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('does not lock a different email', async () => {
    const { service } = fakeSupabase({ signIn: invalid });
    const lock = new LoginLock();
    const auth = new AuthService(service, lock);
    for (let i = 0; i < 5; i += 1) await status(auth.login('a@x.co.za', 'wrong'));
    expect((await status(auth.login('b@x.co.za', 'wrong'))).status).toBe(401);
  });

  it('a correct log-in resets the count', async () => {
    let ok = false;
    const { service } = fakeSupabase({
      signIn: async () => (ok ? { data: { session: { access_token: 't' }, user: { id: 'u1' } }, error: null } : invalid()),
    });
    const auth = new AuthService(service, new LoginLock());
    for (let i = 0; i < 4; i += 1) await status(auth.login('a@x.co.za', 'wrong'));
    ok = true;
    await auth.login('a@x.co.za', 'right');
    ok = false;
    for (let i = 0; i < 4; i += 1) expect((await status(auth.login('a@x.co.za', 'wrong'))).status).toBe(401);
  });

  it('answers a Supabase failure with the server problem message and does not count it as a wrong password', async () => {
    const { service } = fakeSupabase({ signIn: async () => ({ data: { session: null, user: null }, error: { status: 500, message: 'boom' } }) });
    const auth = new AuthService(service, new LoginLock());
    for (let i = 0; i < 6; i += 1) expect(await status(auth.login('a@x.co.za', 'x'))).toEqual({ status: 500, message: SERVER });
  });

  it('refuses a disabled account like wrong details', async () => {
    const { service } = fakeSupabase({
      rows: { staff_profiles: { id: 'u1', full_name: 'Gone', role: 'Clinical', active: false, facility_id: 'f1' } },
    });
    const auth = new AuthService(service, new LoginLock());
    expect(await status(auth.login('a@x.co.za', 'right'))).toEqual({ status: 401, message: WRONG });
  });

  it('refuses an account with no StaffProfile', async () => {
    const { service } = fakeSupabase({ rows: {} });
    const auth = new AuthService(service, new LoginLock());
    expect((await status(auth.login('a@x.co.za', 'right'))).status).toBe(401);
  });

  it('treats a missing email or password as wrong details', async () => {
    const { service } = fakeSupabase({});
    const auth = new AuthService(service, new LoginLock());
    expect(await status(auth.login('', ''))).toEqual({ status: 401, message: WRONG });
  });
});

describe('AuthService.authenticate (token check, OP3)', () => {
  it('returns the user for a good token', async () => {
    const { service } = fakeSupabase({});
    const user = await new AuthService(service, new LoginLock()).authenticate('tok');
    expect(user).toMatchObject({ id: 'u1', role: 'Clinical', fullName: 'Nomsa Khumalo', facilityId: 'f1', facilityName: 'Ubuntu Community Clinic', token: 'tok' });
  });

  it.each([undefined, ''])('answers the session message when the token is %p', async (token) => {
    const { service } = fakeSupabase({});
    expect(await status(new AuthService(service, new LoginLock()).authenticate(token))).toEqual({ status: 401, message: SESSION_ENDED });
  });

  it('answers the session message when the token is expired or wrong', async () => {
    const { service } = fakeSupabase({ getUser: async () => ({ data: { user: null }, error: { message: 'jwt expired' } }) });
    expect(await status(new AuthService(service, new LoginLock()).authenticate('old'))).toEqual({ status: 401, message: SESSION_ENDED });
  });

  it('refuses a disabled account with the session message (SEC26)', async () => {
    const { service } = fakeSupabase({
      rows: { staff_profiles: { id: 'u1', full_name: 'Gone', role: 'Reception', active: false, facility_id: 'f1' } },
    });
    expect(await status(new AuthService(service, new LoginLock()).authenticate('tok'))).toEqual({ status: 401, message: SESSION_ENDED });
  });
});
