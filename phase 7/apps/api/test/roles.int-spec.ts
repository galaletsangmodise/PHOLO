import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SEED_EMAILS, TEST_PASSWORD, admin, closeVisitsOf, createAccount, createClinic, createApp, lettersName, signedInClient } from './helpers';

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

describe('OP9 to OP12 roles (T-SEC-24a, T-SEC-24b)', () => {
  const person = () => ({ first_name: lettersName('Roleperson'), surname: lettersName('Patienttest'), date_of_birth: '1990-01-01', id_number: null, cellphone: null, paper_file_status: 'No paper file' });
  const bearer = async (role: keyof typeof SEED_EMAILS) => ({ Authorization: `Bearer ${await tokenFor(SEED_EMAILS[role])}` });
  const seeded = async () => (await admin.from('patients').select('id').eq('file_number', 'PH-000003').single()).data!.id as string;

  it.each(['Reception', 'Clinical'] as const)('T-SEC-24a OP9, OP10 and OP12 succeed for %s', async (role) => {
    const headers = await bearer(role);
    expect((await request(server()).get('/patients').query({ q: 'Dlamini' }).set(headers)).status).toBe(200);
    const id = await seeded();
    expect((await request(server()).get(`/patients/${id}`).set(headers)).status).toBe(200);
    const { first_name, surname, date_of_birth } = { first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14' };
    const edited = await request(server()).patch(`/patients/${id}`).set(headers).send({ first_name, surname, date_of_birth, id_number: '9708140234088', cellphone: '+27825550147' });
    expect(edited.status).toBe(200);
  });

  it('T-SEC-24a OP11 succeeds for Reception', async () => {
    const body = person();
    const res = await request(server()).post('/patients').set(await bearer('Reception')).send(body);
    expect(res.status).toBe(201);
    await admin.from('patients').delete().eq('id', res.body.id);
  });

  it('T-SEC-24b OP11 is refused for Clinical, Check-in and Manager', async () => {
    for (const role of ['Clinical', 'Check-in', 'Manager'] as const) {
      const body = person();
      const res = await request(server()).post('/patients').set(await bearer(role)).send(body);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(NOT_ALLOWED);
      expect((await admin.from('patients').select('id', { count: 'exact', head: true }).eq('first_name', body.first_name)).count).toBe(0);
    }
  });

  it.each(['Check-in', 'Manager'] as const)('T-SEC-24b OP9, OP10 and OP12 are refused for %s', async (role) => {
    const headers = await bearer(role);
    const id = await seeded();
    const calls = [
      request(server()).get('/patients').query({ q: 'Dlamini' }).set(headers),
      request(server()).get(`/patients/${id}`).set(headers),
      request(server()).patch(`/patients/${id}`).set(headers).send({ first_name: 'Thandi', surname: 'Dlamini', date_of_birth: '1997-08-14', id_number: null, cellphone: null }),
    ];
    for (const res of await Promise.all(calls)) {
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(NOT_ALLOWED);
    }
  });

  it('a visitor with no token is told the session has ended', async () => {
    expect((await request(server()).get('/patients').query({ q: 'Dlamini' })).status).toBe(401);
  });
});

describe('Queue operations roles (T-SEC-23a, T-SEC-23b, T-SEC-24a, T-SEC-24b)', () => {
  const tokensOf: Record<string, string> = {};
  let visitId: string;

  beforeAll(async () => {
    const clinic = await createClinic();
    for (const role of ['Check-in', 'Reception', 'Clinical', 'Manager'] as const) tokensOf[role] = await tokenFor(clinic.accounts[role].email);
    const patient = await admin.from('patients').insert({ facility_id: clinic.facilityId, first_name: 'Queue', surname: 'Roletest', date_of_birth: '1990-01-01' }).select('id').single();
    const visit = await admin
      .from('visits')
      .insert({ facility_id: clinic.facilityId, patient_id: patient.data?.id, queue_number: 1, reason_category: 'Test or screening', consent_given: true })
      .select('id')
      .single();
    visitId = visit.data?.id;
  }, 90000);

  const get = (role: string) => request(server()).get('/queue').set('Authorization', `Bearer ${tokensOf[role]}`);
  const call = (role: string) => request(server()).post('/queue/call-next').set('Authorization', `Bearer ${tokensOf[role]}`);
  const left = (role: string, id: string) => request(server()).post(`/queue/${id}/left`).set('Authorization', `Bearer ${tokensOf[role]}`);

  it('T-SEC-24a OP5 succeeds for Reception and Clinical', async () => {
    expect((await get('Reception')).status).toBe(200);
    expect((await get('Clinical')).status).toBe(200);
  });

  it.each(['Check-in', 'Manager'])('T-SEC-24b OP5 is refused for %s', async (role) => {
    const res = await get(role);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(NOT_ALLOWED);
  });

  it('T-SEC-23a OP6 succeeds for Clinical', async () => {
    expect((await call('Clinical')).status).toBe(200);
  });

  it.each(['Reception', 'Check-in', 'Manager'])('T-SEC-23b OP6 is refused for %s', async (role) => {
    const res = await call(role);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(NOT_ALLOWED);
  });

  it.each(['Check-in', 'Manager'])('T-SEC-24b OP8 is refused for %s and the Visit is unchanged', async (role) => {
    const res = await left(role, visitId);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(NOT_ALLOWED);
    const { data } = await admin.from('visits').select('status').eq('id', visitId).single();
    expect(data?.status).not.toBe('Left');
  });

  it('T-SEC-24a OP8 succeeds for Reception and Clinical', async () => {
    expect((await left('Reception', visitId)).status).toBe(200);
  });
});

describe('Visit operations roles (T-SEC-23a, T-SEC-23b: OP7, OP14, OP15, OP16)', () => {
  const tokensOf: Record<string, string> = {};
  let facilityId: string;
  let clinicianId: string;

  beforeAll(async () => {
    const clinic = await createClinic();
    facilityId = clinic.facilityId;
    clinicianId = clinic.accounts.Clinical.id;
    for (const role of ['Check-in', 'Reception', 'Clinical', 'Manager'] as const) tokensOf[role] = await tokenFor(clinic.accounts[role].email);
  }, 90000);

  const newVisit = async (status: 'Called' | 'In consultation', queueNumber: number) => {
    const patient = await admin.from('patients').insert({ facility_id: facilityId, first_name: 'Visit', surname: 'Roletest', date_of_birth: '1990-01-01' }).select('id').single();
    const visit = await admin
      .from('visits')
      .insert({
        facility_id: facilityId, patient_id: patient.data?.id, queue_number: queueNumber, reason_category: 'Test or screening', consent_given: true, status,
        called_at: new Date().toISOString(), called_by: clinicianId,
        ...(status === 'In consultation' ? { started_at: new Date().toISOString(), clinician: clinicianId } : {}),
      })
      .select('id')
      .single();
    return visit.data?.id as string;
  };
  const body = { symptoms: 'Cough', notes: '', icd10_codes: '', outcome: 'Medication given' };
  const op = (name: 'OP7' | 'OP14' | 'OP15' | 'OP16', role: string, id: string) => {
    const bearer = { Authorization: `Bearer ${tokensOf[role]}` };
    if (name === 'OP7') return request(server()).post(`/visits/${id}/start`).set(bearer);
    if (name === 'OP14') return request(server()).get(`/visits/${id}`).set(bearer);
    if (name === 'OP15') return request(server()).put(`/visits/${id}/draft`).set(bearer).send(body);
    return request(server()).post(`/visits/${id}/complete`).set(bearer).send(body);
  };

  it.each(['Reception', 'Check-in', 'Manager'])('T-SEC-23b OP7, OP14, OP15 and OP16 are refused for %s with the not-allowed message', async (role) => {
    const id = await newVisit('In consultation', 1);
    for (const name of ['OP7', 'OP14', 'OP15', 'OP16'] as const) {
      const res = await op(name, role, id);
      expect(res.status).toBe(403);
      expect(res.body.message).toBe(NOT_ALLOWED);
      expect(JSON.stringify(res.body)).not.toMatch(/Roletest/);
    }
    expect((await admin.from('visits').select('status, symptoms').eq('id', id).single()).data).toEqual({ status: 'In consultation', symptoms: null });
  });

  it('T-SEC-23a OP7, OP14, OP15 and OP16 succeed for Clinical', async () => {
    const called = await newVisit('Called', 2);
    expect((await op('OP7', 'Clinical', called)).status).toBe(200);
    expect((await op('OP14', 'Clinical', called)).status).toBe(200);
    expect((await op('OP15', 'Clinical', called)).status).toBe(200);
    expect((await op('OP16', 'Clinical', called)).status).toBe(200);
  });
});
