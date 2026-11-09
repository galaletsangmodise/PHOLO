import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD, TestClinic, addAccount, addVisit, admin, createApp, createClinic, minutesAgo } from './helpers';

let app: INestApplication;
let clinic: TestClinic;
const tokens: Record<string, string> = {};

const server = () => app.getHttpServer();
const login = async (email: string): Promise<string> =>
  (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const list = (token: string, tab: 'active' | 'done' = 'active') => request(server()).get('/queue').query({ tab }).set(as(token));
const callNext = (token: string) => request(server()).post('/queue/call-next').set(as(token));
const markLeft = (token: string, visitId: string) => request(server()).post(`/queue/${visitId}/left`).set(as(token));

beforeAll(async () => {
  app = await createApp();
  clinic = await createClinic();
  for (const role of ['Reception', 'Clinical', 'Check-in', 'Manager'] as const) tokens[role] = await login(clinic.accounts[role].email);
}, 90000);
afterAll(async () => {
  await app.close();
});

/** Each test works in its own Facility, so earlier tests cannot change what it sees. */
async function freshClinic() {
  const own = await createClinic();
  return {
    own,
    reception: await login(own.accounts.Reception.email),
    clinical: await login(own.accounts.Clinical.email),
  };
}

describe('OP5 list the Queue', () => {
  it('T-INT-3 Reception gets rows without any clinical field; Check-in and Manager are refused', async () => {
    const { own, reception } = await freshClinic();
    await addVisit(own.facilityId, 1, { firstName: 'Thandi', surname: 'Dlamini' });
    const res = await list(reception);
    expect(res.status).toBe(200);
    expect(res.body.visits).toHaveLength(1);
    for (const field of ['symptoms', 'notes', 'icd10_codes', 'outcome', 'clinician']) expect(res.body.visits[0]).not.toHaveProperty(field);
    expect(res.body.visits[0]).toMatchObject({ queue_number: 1, first_name: 'Thandi', surname: 'Dlamini', status: 'Waiting' });
    expect(res.body.counts).toEqual({ waiting: 1, in_consultation: 0, completed: 0, uncalled: 1 });

    expect((await list(tokens['Check-in'])).status).toBe(403);
    expect((await list(tokens.Manager)).status).toBe(403);
  });

  it('T-BR2-4 Called first, then Waiting with urgent first, then by Check-in time; finished Visits are not in Active', async () => {
    const { own, reception, clinical } = await freshClinic();
    const normalOld = await addVisit(own.facilityId, 1, { surname: 'Normalold', minutesAgo: 50 });
    const normalNew = await addVisit(own.facilityId, 2, { surname: 'Normalnew', minutesAgo: 40 });
    const urgentNew = await addVisit(own.facilityId, 3, { surname: 'Urgentnew', urgent: true, minutesAgo: 20 });
    const urgentOld = await addVisit(own.facilityId, 4, { surname: 'Urgentold', urgent: true, minutesAgo: 30 });
    const leaver = await addVisit(own.facilityId, 5, { surname: 'Leaver', minutesAgo: 60 });
    expect((await request(server()).post(`/queue/${leaver.visitId}/left`).set(as(reception))).status).toBe(200);

    expect((await callNext(clinical)).body.queue_number).toBe(4); // urgent, earliest
    const res = await list(reception);
    expect(res.body.visits.map((v: { queue_number: number }) => v.queue_number)).toEqual([4, 3, 1, 2]);
    expect(res.body.visits[0].status).toBe('Called');
    expect(normalOld.visitId && normalNew.visitId && urgentNew.visitId && urgentOld.visitId).toBeTruthy();

    const done = await list(reception, 'done');
    expect(done.body.visits.map((v: { queue_number: number }) => v.queue_number)).toEqual([5]);
    expect(done.body.counts).toEqual({ waiting: 4, in_consultation: 0, completed: 0, uncalled: 3 });
  });

  it('T-BR7-6, T-EDGE-9 Visits left open on an earlier day become Left with left_at set and show nowhere today', async () => {
    const { own, reception } = await freshClinic();
    const twoDaysAgo = 2 * 24 * 60;
    const waiting = await addVisit(own.facilityId, 1, { minutesAgo: twoDaysAgo });
    const called = await addVisit(own.facilityId, 2, { minutesAgo: twoDaysAgo, status: 'Called', called_at: minutesAgo(twoDaysAgo - 10) });
    const today = await addVisit(own.facilityId, 3, { minutesAgo: 5 });

    const active = await list(reception);
    expect(active.body.visits.map((v: { id: string }) => v.id)).toEqual([today.visitId]);
    expect((await list(reception, 'done')).body.visits).toEqual([]);

    const { data } = await admin.from('visits').select('id, status, left_at').in('id', [waiting.visitId, called.visitId]);
    expect(data).toHaveLength(2);
    for (const row of data ?? []) {
      expect(row.status).toBe('Left');
      expect(row.left_at).not.toBeNull();
    }
  });
});

describe('OP6 call next patient', () => {
  it('T-US6-1, T-INT-14 the urgent Visit is called, with called_at, called_by and AuditLog called_next', async () => {
    const { own, clinical } = await freshClinic();
    await addVisit(own.facilityId, 1, { surname: 'Dlamini', firstName: 'Thandi', minutesAgo: 54 });
    await addVisit(own.facilityId, 2, { surname: 'Nkosi', firstName: 'Sipho', minutesAgo: 50 });
    const urgent = await addVisit(own.facilityId, 3, { surname: 'Molefe', firstName: 'Palesa', urgent: true, minutesAgo: 43 });

    const res = await callNext(clinical);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ none_waiting: false, queue_number: 3, first_name: 'Palesa', surname: 'Molefe', visit_id: urgent.visitId });

    const { data: visit } = await admin.from('visits').select('status, called_at, called_by').eq('id', urgent.visitId).single();
    expect(visit?.status).toBe('Called');
    expect(visit?.called_at).not.toBeNull();
    expect(visit?.called_by).toBe(own.accounts.Clinical.id);
    const { data: audit } = await admin.from('audit_logs').select('actor_id').eq('entity_id', urgent.visitId).eq('action', 'called_next');
    expect(audit).toHaveLength(1);
    expect(audit?.[0].actor_id).toBe(own.accounts.Clinical.id);
  });

  it('T-US6-2 with nobody waiting the answer is "none waiting"', async () => {
    const { clinical } = await freshClinic();
    const res = await callNext(clinical);
    expect(res.status).toBe(200);
    expect(res.body.none_waiting).toBe(true);
  });

  it('T-EDGE-4 two clinicians calling at the same moment get two different Visits', async () => {
    const { own, clinical } = await freshClinic();
    await addVisit(own.facilityId, 3, { surname: 'Dlamini', firstName: 'Thandi', minutesAgo: 54 });
    await addVisit(own.facilityId, 4, { surname: 'Molefe', firstName: 'Palesa', urgent: true, minutesAgo: 43 });
    const second = await addAccount(own.facilityId, 'Clinical');
    const secondToken = await login(second.email);

    const [a, b] = await Promise.all([callNext(clinical), callNext(secondToken)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect([a.body.queue_number, b.body.queue_number].sort()).toEqual([3, 4]);
  });

  it('T-SEC-23 Reception is refused', async () => {
    const { reception } = await freshClinic();
    const res = await callNext(reception);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You are not allowed to open this page.');
  });
});

describe('OP8 mark as left', () => {
  it('T-US8-1, T-INT-15 a Waiting Visit becomes Left with left_at and AuditLog marked_left and moves to Done today', async () => {
    const { own, reception } = await freshClinic();
    const visit = await addVisit(own.facilityId, 1, { surname: 'Dlamini', firstName: 'Thandi' });
    const res = await markLeft(reception, visit.visitId);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'Left' });

    const { data } = await admin.from('visits').select('status, left_at').eq('id', visit.visitId).single();
    expect(data?.status).toBe('Left');
    expect(data?.left_at).not.toBeNull();
    const { data: audit } = await admin.from('audit_logs').select('actor_id').eq('entity_id', visit.visitId).eq('action', 'marked_left');
    expect(audit).toHaveLength(1);
    expect((await list(reception, 'done')).body.visits.map((v: { id: string }) => v.id)).toEqual([visit.visitId]);
    expect((await list(reception)).body.visits).toEqual([]);
  });

  it('T-EDGE-5 a Called Visit can be marked as left by Clinical', async () => {
    const { own, clinical } = await freshClinic();
    const visit = await addVisit(own.facilityId, 1, {});
    expect((await callNext(clinical)).body.visit_id).toBe(visit.visitId);
    expect((await markLeft(clinical, visit.visitId)).status).toBe(200);
    const { data } = await admin.from('visits').select('status').eq('id', visit.visitId).single();
    expect(data?.status).toBe('Left');
  });

  it('T-INT-15 a Visit that is already finished is refused', async () => {
    const { own, reception } = await freshClinic();
    const visit = await addVisit(own.facilityId, 1, {});
    expect((await markLeft(reception, visit.visitId)).status).toBe(200);
    const again = await markLeft(reception, visit.visitId);
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('This visit can no longer be marked as left.');
  });

  it('a Visit of another Facility or an unknown id is not found', async () => {
    const { reception } = await freshClinic();
    const other = await freshClinic();
    const foreign = await addVisit(other.own.facilityId, 1, {});
    expect((await markLeft(reception, foreign.visitId)).status).toBe(404);
    expect((await markLeft(reception, '00000000-0000-4000-8000-00000000dead')).status).toBe(404);
    expect((await markLeft(reception, 'not-an-id')).status).toBe(404);
    const { data } = await admin.from('visits').select('status').eq('id', foreign.visitId).single();
    expect(data?.status).toBe('Waiting');
  });
});
