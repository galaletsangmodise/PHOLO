import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  Account, SEED_EMAILS, TEST_PASSWORD, admin, closeVisitsOf, createAccount, createApp, lettersName, makeSaId,
} from './helpers';

let app: INestApplication;
let tablet: Account;
let token: string;
const patientIds: string[] = [];

const server = () => app.getHttpServer();
const login = async (email: string): Promise<string> =>
  (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;

beforeAll(async () => {
  app = await createApp();
  tablet = await createAccount('Check-in', 'Test Tablet');
  token = await login(tablet.email);
}, 60000);

afterAll(async () => {
  await closeVisitsOf(patientIds);
  await app.close();
});

function person(overrides: Record<string, unknown> = {}) {
  return {
    first_name: lettersName('Thandi'),
    surname: lettersName('Dlamini'),
    date_of_birth: '1997-08-14',
    id_number: null,
    cellphone: null,
    has_file: false,
    assisted: false,
    reason_category: 'Test or screening',
    urgent: false,
    consent_given: true,
    ...overrides,
  };
}

const checkIn = (body: unknown, bearer = token) =>
  request(server()).post('/checkin').set('Authorization', `Bearer ${bearer}`).send(body as object);

async function visitFor(firstName: string, surname: string) {
  const { data: patient } = await admin.from('patients').select('id, file_number').eq('first_name', firstName).eq('surname', surname).single();
  if (patient) patientIds.push(patient.id);
  const { data: visits } = await admin.from('visits').select('*').eq('patient_id', patient?.id ?? '');
  return { patient, visits: visits ?? [] };
}

describe('OP4 Check-in (T-INT-2, T-INT-11, T-INT-12)', () => {
  it('T-US1-1, T-INT-2 a valid Check-in makes a Visit and an AuditLog row checked_in and returns the Queue number', async () => {
    const body = person({ id_number: makeSaId('1997-08-14', unique4()), cellphone: '082 555 0147' });
    const res = await checkIn(body);
    expect(res.status).toBe(200);
    expect(res.body.queue_number).toBeGreaterThan(0);
    expect(res.body.already_checked_in).toBe(false);

    const { patient, visits } = await visitFor(body.first_name, body.surname);
    expect(visits).toHaveLength(1);
    expect(visits[0].queue_number).toBe(res.body.queue_number);
    expect(visits[0].status).toBe('Waiting');
    expect(visits[0].assisted).toBe(false);
    expect(visits[0].urgent).toBe(false);
    const { data: audit } = await admin.from('audit_logs').select('*').eq('entity_id', visits[0].id).eq('action', 'checked_in');
    expect(audit).toHaveLength(1);
    expect(audit?.[0].actor_id).toBe(tablet.id);
    const { data: stored } = await admin.from('patients').select('cellphone').eq('id', patient?.id ?? '').single();
    expect(stored?.cellphone).toBe('+27825550147');
  });

  it('T-US2-1 "Check in with help" saves the Visit with assisted = Yes', async () => {
    const body = person({ assisted: true, has_file: true, date_of_birth: '1954-05-03' });
    const res = await checkIn(body);
    expect(res.status).toBe(200);
    const { visits } = await visitFor(body.first_name, body.surname);
    expect(visits[0].assisted).toBe(true);
  });

  it('T-US3-1 an urgent answer saves the Visit as urgent and returns urgent', async () => {
    const body = person({ urgent: true, date_of_birth: '2025-01-09', reason_category: 'Baby or child care' });
    const res = await checkIn(body);
    expect(res.status).toBe(200);
    expect(res.body.urgent).toBe(true);
    const { visits } = await visitFor(body.first_name, body.surname);
    expect(visits[0].urgent).toBe(true);
  });

  it('T-US1-3, T-EDGE-3 the same ID number again answers already checked in with the same number and no second Visit', async () => {
    const body = person({ id_number: makeSaId('1985-11-22', unique4()), date_of_birth: '1985-11-22' });
    const first = await checkIn(body);
    const second = await checkIn({ ...body, first_name: body.first_name, urgent: true });
    expect(second.status).toBe(200);
    expect(second.body.already_checked_in).toBe(true);
    expect(second.body.queue_number).toBe(first.body.queue_number);
    const { visits } = await visitFor(body.first_name, body.surname);
    expect(visits).toHaveLength(1);
  });

  it('T-INT-12 the answer holds the four fields only and nothing stored about the Patient (BR4)', async () => {
    const body = person();
    const res = await checkIn(body);
    expect(Object.keys(res.body).sort()).toEqual(['already_checked_in', 'has_file', 'queue_number', 'urgent']);
    expect(JSON.stringify(res.body)).not.toContain(body.first_name);
  });

  it.each([
    ['first_name', '', 'Please enter your first name.'],
    ['surname', 'Dlamini1', 'Please enter your surname.'],
    ['date_of_birth', '1997-02-30', 'Please enter a real date of birth, for example 14 / 08 / 1997.'],
    ['id_number', '9708140234089', 'This ID number does not look right. Check it, or leave it empty if you do not have one.'],
    ['cellphone', '08255501', 'Enter a South African cellphone number, for example 082 555 0147, or leave it empty.'],
    ['has_file', null, 'Please choose Yes or No.'],
    ['reason_category', null, 'Please choose why you are here today.'],
    ['urgent', null, 'Please choose Yes or No.'],
    ['consent_given', false, 'Please tick the box to agree to the Privacy Notice to check in.'],
  ])('T-INT-11 invalid %s comes back with its exact message and nothing is saved', async (field, value, message) => {
    const body = person({ [field]: value });
    const res = await checkIn(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe(message);
    const { count } = await admin.from('patients').select('id', { count: 'exact', head: true }).eq('surname', body.surname as string);
    expect(count).toBe(0);
  });

  it('T-BR14-1 the 41st Check-in from one tablet in 10 minutes gives the BR14 message', async () => {
    const limited = await createAccount('Check-in', 'Limit Tablet');
    const limitedToken = await login(limited.email);
    let last = { status: 0, body: {} as { message?: string } };
    for (let i = 0; i < 41; i += 1) {
      last = await checkIn(person(), limitedToken);
      if (i < 40) expect(last.status).toBe(200);
    }
    expect(last.status).toBe(429);
    expect(last.body.message).toBe('Too many Check-ins at once. Please wait one minute and try again.');
    const { data } = await admin.from('patients').select('id').order('created_at', { ascending: false }).limit(45);
    patientIds.push(...(data ?? []).map((row) => row.id));
  }, 120000);

  it('refuses a call with no token', async () => {
    const res = await request(server()).post('/checkin').send(person());
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Your session has ended. Please log in again.');
  });

  it('keeps the seeded tablet account working', async () => {
    expect((await login(SEED_EMAILS['Check-in'])).length).toBeGreaterThan(10);
  });
});

function unique4(): string {
  return String(1000 + Math.floor(Math.random() * 8999));
}
