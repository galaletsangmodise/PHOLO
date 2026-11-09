import { INestApplication, Logger } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD, TestClinic, addVisit, createApp, createClinic, minutesAgo } from './helpers';

let app: INestApplication;
let clinic: TestClinic;
const tokens: Record<string, string> = {};
const server = () => app.getHttpServer();
const login = async (email: string): Promise<string> =>
  (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;
const bearer = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });

/** Everything the user can ever read in an error: the PRD 12.2 messages and the messages of the rules (PRD 6.2, S3, M2, M3, S9). */
const ALLOWED_KEYS = ['message', 'field'];

beforeAll(async () => {
  app = await createApp();
  clinic = await createClinic();
  for (const role of ['Check-in', 'Reception', 'Clinical', 'Manager'] as const) tokens[role] = await login(clinic.accounts[role].email);
}, 90000);
afterAll(async () => {
  await app.close();
});

const clean = (body: Record<string, unknown>) => {
  expect(Object.keys(body).every((key) => ALLOWED_KEYS.includes(key))).toBe(true);
  expect(typeof body.message).toBe('string');
  expect(String(body.message)).not.toMatch(/statusCode|Bad Request|Unauthorized|Forbidden|Not Found|Internal server error|Cannot (GET|POST|PUT|PATCH)|violates|constraint|SQLSTATE|PGRST|JWT|\b[0-9]{5}\b/);
};

describe('T-INT-17 input the screen would have refused is refused by the server with the exact message', () => {
  const EMPTY_BODIES: Array<[string, string, string, string]> = [
    ['OP4 check-in', 'post', '/checkin', 'Check-in'],
    ['OP11 create Patient', 'post', '/patients', 'Reception'],
    ['OP12 update Patient', 'patch', '/patients/00000000-0000-4000-8000-0000000000aa', 'Reception'],
    ['OP13 paper file history', 'patch', '/patients/00000000-0000-4000-8000-0000000000aa/paper-history', 'Reception'],
  ];
  it.each(EMPTY_BODIES)('%s with an empty body is a 400 with a field message, not a 500', async (_name, method, path, role) => {
    const res = await (request(server()) as unknown as Record<string, (url: string) => request.Test>)[method](path).set(bearer(role)).send({});
    expect(res.status).toBe(400);
    clean(res.body);
    expect(typeof res.body.field).toBe('string');
  });

  it('OP15 and OP16 with oversized or malformed values are 400 with the field message', async () => {
    const { visitId } = await addVisit(clinic.facilityId, 1, { status: 'In consultation', called_at: minutesAgo(8), called_by: clinic.accounts.Clinical.id, started_at: minutesAgo(5), clinician: clinic.accounts.Clinical.id });
    const draft = await request(server()).put(`/visits/${visitId}/draft`).set(bearer('Clinical')).send({ symptoms: 'x'.repeat(1001), notes: '', icd10_codes: '', outcome: '' });
    expect(draft.status).toBe(400);
    expect(draft.body).toEqual({ message: 'Symptoms can be at most 1000 characters.', field: 'symptoms' });
    const complete = await request(server()).post(`/visits/${visitId}/complete`).set(bearer('Clinical')).send({ symptoms: 'Cough', notes: '', icd10_codes: 'J069x', outcome: 'Other' });
    expect(complete.body).toEqual({ message: 'Use codes like J06.9, separated by commas. Maximum 5 codes.', field: 'icd10_codes' });
  });

  it('OP9 with a one-letter search is refused with the exact message', async () => {
    const res = await request(server()).get('/patients?q=a').set(bearer('Reception'));
    expect(res.status).toBe(400);
    clean(res.body);
  });
});

describe('T-INT-19 every error shows its exact PRD 12.2 message and never a raw code', () => {
  it('no token, a bad token: "Your session has ended. Please log in again."', async () => {
    for (const header of [{}, { Authorization: 'Bearer not-a-token' }, { Authorization: 'garbage' }]) {
      const res = await request(server()).get('/queue').set(header);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: 'Your session has ended. Please log in again.' });
    }
  });

  it('a wrong role: "You are not allowed to open this page."', async () => {
    for (const [role, path] of [['Check-in', '/queue'], ['Reception', '/summary'], ['Manager', '/queue'], ['Clinical', '/summary']] as const) {
      const res = await request(server()).get(path).set(bearer(role));
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ message: 'You are not allowed to open this page.' });
    }
  });

  it('a body that is not JSON, an unknown route and an id that is not an id never show Nest text', async () => {
    const broken = await request(server()).post('/patients').set(bearer('Reception')).set('Content-Type', 'application/json').send('{"first_name": ');
    const unknown = await request(server()).get('/no-such-route').set(bearer('Reception'));
    const badId = await request(server()).get('/visits/not-an-id').set(bearer('Clinical'));
    for (const res of [broken, unknown, badId]) {
      expect(res.status).toBeLessThan(500);
      clean(res.body);
    }
    expect(broken.body.message).toBe('Something went wrong on our side. Please try again.');
  });

  it('a wrong password: "Email or password is not correct. Try again."', async () => {
    const res = await request(server()).post('/auth/login').send({ email: clinic.accounts.Reception.email, password: 'Wrong-password-1' });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: 'Email or password is not correct. Try again.' });
  });
});

describe('T-INT-18 the logs hold no password, token or personal data', () => {
  it('after wrong passwords, refusals, a broken body and a full set of calls, nothing sensitive was logged', async () => {
    const logged: string[] = [];
    const spies = (['log', 'warn', 'error', 'debug', 'verbose'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' '))),
    );
    const out = jest.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => (logged.push(String(chunk)), true));
    const err = jest.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => (logged.push(String(chunk)), true));
    const surname = 'Logtestsurname';
    try {
      await request(server()).post('/auth/login').send({ email: clinic.accounts.Reception.email, password: 'Logtest-Secret-9' });
      await request(server()).post('/patients').set(bearer('Reception')).set('Content-Type', 'application/json').send(`{"surname":"${surname}", `);
      await request(server()).post('/patients').set(bearer('Reception')).send({ first_name: 'Logtestname', surname, date_of_birth: '1990-01-01', id_number: null, cellphone: '+27825550199', paper_file_status: 'No paper file' });
      await request(server()).get(`/patients?q=${surname}`).set(bearer('Reception'));
      await request(server()).get('/queue').set(bearer('Reception'));
      await request(server()).get('/summary').set(bearer('Manager'));
    } finally {
      for (const spy of [...spies, out, err]) spy.mockRestore();
    }
    const text = logged.join('\n');
    expect(text).not.toContain('Logtest-Secret-9');
    expect(text).not.toContain(tokens.Reception);
    expect(text).not.toContain(TEST_PASSWORD);
    expect(text).not.toMatch(/Logtestname|Logtestsurname|\+27825550199|Bearer /);
  });
});

