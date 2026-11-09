import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD, TestClinic, addAccount, admin, createApp, createClinic, lettersName, makeSaId } from './helpers';

let app: INestApplication;
const server = () => app.getHttpServer();
const login = async (email: string): Promise<string> =>
  (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

beforeAll(async () => {
  app = await createApp();
}, 90000);
afterAll(async () => {
  await app.close();
});

const DAY = 300;
/** A busy day: 300 Check-ins in one Facility (a Patient and a Visit each), made as the administrator in two bulk inserts. */
async function busyDay(): Promise<{ clinic: TestClinic; surnames: string[] }> {
  const clinic = await createClinic();
  const surname = lettersName('Busyday');
  const patients = Array.from({ length: DAY }, (_, i) => ({
    facility_id: clinic.facilityId, first_name: lettersName(`Pat${i}`), surname, date_of_birth: '1990-01-01',
  }));
  const inserted = await admin.from('patients').insert(patients).select('id');
  if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? 'No patients');
  const visits = inserted.data.map((patient, index) => ({
    facility_id: clinic.facilityId, patient_id: patient.id, queue_number: index + 1, reason_category: 'Test or screening', consent_given: true,
    urgent: index % 17 === 0, assisted: index % 5 === 0,
  }));
  const made = await admin.from('visits').insert(visits);
  if (made.error) throw new Error(made.error.message);
  return { clinic, surnames: [surname] };
}

describe('T-NFR-2 and T-NFR-7: a busy day (1 Facility, 10 staff accounts, 300 Check-ins)', () => {
  let clinic: TestClinic;
  let surname: string;
  let tokens: Record<string, string>;

  beforeAll(async () => {
    const day = await busyDay();
    clinic = day.clinic;
    surname = day.surnames[0];
    // 4 accounts from createClinic and 6 more (10 in all).
    for (let i = 0; i < 3; i += 1) await addAccount(clinic.facilityId, 'Reception', `Extra Reception ${i}`);
    for (let i = 0; i < 3; i += 1) await addAccount(clinic.facilityId, 'Clinical', `Extra Clinical ${i}`);
    tokens = {
      Reception: await login(clinic.accounts.Reception.email),
      Clinical: await login(clinic.accounts.Clinical.email),
      Manager: await login(clinic.accounts.Manager.email),
    };
  }, 240000);

  it('T-NFR-2 the Queue answer for 300 Visits is under 100 KB', async () => {
    const res = await request(server()).get('/queue?tab=active').set(bearer(tokens.Reception));
    expect(res.status).toBe(200);
    expect(res.body.visits).toHaveLength(DAY);
    expect(Buffer.byteLength(JSON.stringify(res.body))).toBeLessThan(100 * 1024);
  }, 60000);

  it('T-NFR-2 a search shows at most 20 results', async () => {
    const res = await request(server()).get('/patients').query({ q: surname }).set(bearer(tokens.Reception));
    expect(res.status).toBe(200);
    expect(res.body.patients.length).toBeLessThanOrEqual(20);
  }, 60000);

  it('T-NFR-2 no answer holds an image or video', async () => {
    const res = await request(server()).get('/queue?tab=active').set(bearer(tokens.Clinical));
    expect(res.headers['content-type']).toMatch(/json/);
    expect(JSON.stringify(res.body)).not.toMatch(/data:image|\.png|\.jpg|\.mp4/);
  }, 60000);

  it('T-NFR-7 the Queue, call next, the summary and the Patient File still answer correctly', async () => {
    const queue = await request(server()).get('/queue?tab=active').set(bearer(tokens.Reception));
    expect(queue.body.counts).toMatchObject({ waiting: DAY, uncalled: DAY });
    // Urgent Visits come first: number 1 (index 0) is urgent and the oldest.
    const called = await request(server()).post('/queue/call-next').set(bearer(tokens.Clinical));
    expect(called.status).toBe(200);
    expect(called.body.none_waiting).toBeUndefined();
    const summary = await request(server()).get('/summary').set(bearer(tokens.Manager));
    expect(summary.body).toMatchObject({ checked_in: DAY, still_waiting: DAY });
    const file = await request(server()).get(`/patients/${queue.body.visits[0].patient_id}`).set(bearer(tokens.Reception));
    expect(file.status).toBe(200);
  }, 120000);
});

describe('T-NFR-8 the limits', () => {
  it('BR14: the 41st Check-in from one tablet within 10 minutes is refused with the exact message and the 40 before it were accepted', async () => {
    const clinic = await createClinic();
    const token = await login(clinic.accounts['Check-in'].email);
    let last = { status: 0, body: {} as { message?: string } };
    for (let i = 1; i <= 41; i += 1) {
      last = await request(server()).post('/checkin').set(bearer(token)).send({
        first_name: lettersName('Limit'), surname: lettersName('Tester'), date_of_birth: '1997-08-14', id_number: makeSaId('1997-08-14', String(1000 + i)),
        cellphone: null, has_file: false, assisted: false, reason_category: 'Test or screening', urgent: false, consent_given: true,
      });
      if (i <= 40) expect(last.status).toBe(200);
    }
    expect(last.status).toBe(429);
    expect(last.body.message).toBe('Too many Check-ins at once. Please wait one minute and try again.');
  }, 180000);

  it('BR12: 5 wrong passwords disable log-in for 60 seconds, even with the right password', async () => {
    const clinic = await createClinic();
    const { email } = clinic.accounts.Reception;
    for (let i = 0; i < 5; i += 1) {
      expect((await request(server()).post('/auth/login').send({ email, password: 'Wrong-password-1' })).status).toBe(401);
    }
    const locked = await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD });
    expect(locked.status).toBe(429);
    expect(locked.body.message).toBe('Too many tries. Wait 60 seconds and try again.');
  }, 60000);
});
