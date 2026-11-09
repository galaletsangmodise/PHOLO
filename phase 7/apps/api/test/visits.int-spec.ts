import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TEST_PASSWORD, TestClinic, addVisit, admin, createApp, createClinic, minutesAgo } from './helpers';

let app: INestApplication;
const server = () => app.getHttpServer();
const login = async (email: string): Promise<string> =>
  (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const NOT_ALLOWED = 'You are not allowed to open this page.';

const FORM = { symptoms: 'Cough for 5 days, fever at night.', notes: 'Temperature 38.2. Chest clear.', icd10_codes: 'J06.9', outcome: 'Treated and sent home' };

beforeAll(async () => {
  app = await createApp();
}, 90000);
afterAll(async () => {
  await app.close();
});

/** Each test works in its own Facility (Visits and the AuditLog cannot be deleted, so tests must not share them). */
async function fresh(): Promise<{ own: TestClinic; clinical: string; reception: string; clinicianId: string }> {
  const own = await createClinic();
  return { own, clinical: await login(own.accounts.Clinical.email), reception: await login(own.accounts.Reception.email), clinicianId: own.accounts.Clinical.id };
}

/** A Visit that is already In consultation with this clinician (set up as the administrator). */
const inConsultation = (own: TestClinic, clinicianId: string, queueNumber = 1, extra: Record<string, unknown> = {}) =>
  addVisit(own.facilityId, queueNumber, {
    status: 'In consultation', called_at: minutesAgo(8), called_by: clinicianId, started_at: minutesAgo(5), clinician: clinicianId, ...extra,
  });

const audits = async (visitId: string, action: string) =>
  (await admin.from('audit_logs').select('id', { count: 'exact', head: true }).eq('entity_id', visitId).eq('action', action)).count;

describe('OP7 start consultation', () => {
  it('T-INT-4 a Called Visit becomes In consultation with started_at and clinician set, and started_consultation is logged', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await addVisit(own.facilityId, 1, { status: 'Called', called_at: minutesAgo(3), called_by: clinicianId });
    const res = await request(server()).post(`/visits/${visitId}/start`).set(as(clinical));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'In consultation' });
    const { data } = await admin.from('visits').select('status, started_at, clinician').eq('id', visitId).single();
    expect(data?.status).toBe('In consultation');
    expect(data?.started_at).not.toBeNull();
    expect(data?.clinician).toBe(clinicianId);
    expect(await audits(visitId, 'started_consultation')).toBe(1);
  });

  it('T-INT-4 Reception is refused and the Visit is unchanged', async () => {
    const { own, reception, clinicianId } = await fresh();
    const { visitId } = await addVisit(own.facilityId, 1, { status: 'Called', called_at: minutesAgo(3), called_by: clinicianId });
    const res = await request(server()).post(`/visits/${visitId}/start`).set(as(reception));
    expect(res.status).toBe(403);
    expect(res.body.message).toBe(NOT_ALLOWED);
    expect((await admin.from('visits').select('status').eq('id', visitId).single()).data?.status).toBe('Called');
  });

  it('a Waiting Visit cannot be started (BR7)', async () => {
    const { own, clinical } = await fresh();
    const { visitId } = await addVisit(own.facilityId, 1);
    expect((await request(server()).post(`/visits/${visitId}/start`).set(as(clinical))).status).toBe(409);
  });
});

describe('OP14 get Visit', () => {
  it('T-INT-8 Clinical gets the Visit with its saved draft and the paper file history; Reception is refused', async () => {
    const { own, clinical, reception, clinicianId } = await fresh();
    const { visitId, patientId } = await inConsultation(own, clinicianId, 1, { symptoms: 'Cough', urgent: true });
    await admin.from('patients').update({ paper_file_status: 'Paper file - not yet digitised' }).eq('id', patientId);
    await admin.from('patients').update({ allergies: 'Penicillin', chronic_conditions: 'Asthma' }).eq('id', patientId);

    const res = await request(server()).get(`/visits/${visitId}`).set(as(clinical));
    expect(res.status).toBe(200);
    expect(res.body.visit).toMatchObject({ id: visitId, queue_number: 1, status: 'In consultation', urgent: true, symptoms: 'Cough', notes: null });
    expect(res.body.patient).toMatchObject({ id: patientId, allergies: 'Penicillin', chronic_conditions: 'Asthma' });

    const refused = await request(server()).get(`/visits/${visitId}`).set(as(reception));
    expect(refused.status).toBe(403);
    expect(refused.body.message).toBe(NOT_ALLOWED);
  });

  it('T-BR9-3 a Visit that is not In consultation is still answered, with its status, so S9 can go to S6 or S8', async () => {
    const { own, clinical } = await fresh();
    const { visitId } = await addVisit(own.facilityId, 1);
    const res = await request(server()).get(`/visits/${visitId}`).set(as(clinical));
    expect(res.status).toBe(200);
    expect(res.body.visit.status).toBe('Waiting');
  });

  it('a Visit of another Facility looks like no Visit at all (404)', async () => {
    const { clinical } = await fresh();
    const other = await createClinic();
    const { visitId } = await addVisit(other.facilityId, 1);
    expect((await request(server()).get(`/visits/${visitId}`).set(as(clinical))).status).toBe(404);
    expect((await request(server()).get('/visits/not-an-id').set(as(clinical))).status).toBe(404);
  });
});

describe('OP15 save draft', () => {
  it('T-US10-1, T-INT-16 the draft is saved, the Visit stays In consultation, saved_draft is logged, and OP14 returns the same text', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId);
    const res = await request(server()).put(`/visits/${visitId}/draft`).set(as(clinical)).send(FORM);
    expect(res.status).toBe(200);
    const { data } = await admin.from('visits').select('status, symptoms, notes, icd10_codes, outcome, completed_at').eq('id', visitId).single();
    expect(data).toMatchObject({ status: 'In consultation', symptoms: FORM.symptoms, notes: FORM.notes, icd10_codes: 'J06.9', outcome: FORM.outcome, completed_at: null });
    expect(await audits(visitId, 'saved_draft')).toBe(1);
    const again = await request(server()).get(`/visits/${visitId}`).set(as(clinical));
    expect(again.body.visit).toMatchObject({ symptoms: FORM.symptoms, notes: FORM.notes });
  });

  it('T-BR8-6 a draft with every field empty is saved', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId, 1, { symptoms: 'Old text' });
    const res = await request(server()).put(`/visits/${visitId}/draft`).set(as(clinical)).send({ symptoms: '', notes: '', icd10_codes: '', outcome: '' });
    expect(res.status).toBe(200);
    expect((await admin.from('visits').select('symptoms, outcome').eq('id', visitId).single()).data).toEqual({ symptoms: null, outcome: null });
  });

  it('T-BR8-4 notes of 2000 characters are saved, 2001 are refused', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId);
    expect((await request(server()).put(`/visits/${visitId}/draft`).set(as(clinical)).send({ ...FORM, notes: 'n'.repeat(2000) })).status).toBe(200);
    const res = await request(server()).put(`/visits/${visitId}/draft`).set(as(clinical)).send({ ...FORM, notes: 'n'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: 'Notes can be at most 2000 characters.', field: 'notes' });
  });

  it('Reception is refused', async () => {
    const { own, reception, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId);
    const res = await request(server()).put(`/visits/${visitId}/draft`).set(as(reception)).send(FORM);
    expect(res.status).toBe(403);
    expect((await admin.from('visits').select('symptoms').eq('id', visitId).single()).data?.symptoms).toBeNull();
  });
});

describe('OP16 complete visit', () => {
  it('T-US9-1, T-INT-16 the Visit becomes Completed with completed_at set and completed_visit logged; it then shows in the Patient File for Clinical only', async () => {
    const { own, clinical, reception, clinicianId } = await fresh();
    const { visitId, patientId } = await inConsultation(own, clinicianId);
    const res = await request(server()).post(`/visits/${visitId}/complete`).set(as(clinical)).send(FORM);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'Completed' });
    const { data } = await admin.from('visits').select('status, completed_at, symptoms, outcome').eq('id', visitId).single();
    expect(data?.status).toBe('Completed');
    expect(data?.completed_at).not.toBeNull();
    expect(await audits(visitId, 'completed_visit')).toBe(1);

    const forClinical = await request(server()).get(`/patients/${patientId}`).set(as(clinical));
    expect(forClinical.body.visits[0]).toMatchObject({ status: 'Completed', symptoms: FORM.symptoms, icd10_codes: 'J06.9', outcome: FORM.outcome, clinician_name: 'Test Clinical' });
    const forReception = await request(server()).get(`/patients/${patientId}`).set(as(reception));
    expect(forReception.body.visits[0].status).toBe('Completed');
    for (const key of ['symptoms', 'notes', 'icd10_codes', 'outcome', 'clinician_name']) expect(forReception.body.visits[0]).not.toHaveProperty(key);
  });

  it.each([
    ['T-BR8-1 empty symptoms', { ...FORM, symptoms: '' }, 'symptoms'],
    ['T-BR8-2 no outcome', { ...FORM, outcome: '' }, 'outcome'],
    ['T-US9-3 "J069x"', { ...FORM, icd10_codes: 'J069x' }, 'icd10_codes'],
    ['T-BR8-3 six codes', { ...FORM, icd10_codes: 'A01, A02, A03, A04, A05, A06' }, 'icd10_codes'],
    ['T-BR8-5 2001 characters of notes', { ...FORM, notes: 'n'.repeat(2001) }, 'notes'],
  ])('%s is refused with the field and nothing is saved or logged', async (_name, body, field) => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId);
    const res = await request(server()).post(`/visits/${visitId}/complete`).set(as(clinical)).send(body);
    expect(res.status).toBe(400);
    expect(res.body.field).toBe(field);
    expect((await admin.from('visits').select('status').eq('id', visitId).single()).data?.status).toBe('In consultation');
    expect(await audits(visitId, 'completed_visit')).toBe(0);
  });

  it('T-BR8-2 five codes and 2000 characters of notes complete the Visit', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId);
    const res = await request(server()).post(`/visits/${visitId}/complete`).set(as(clinical)).send({ ...FORM, icd10_codes: 'A01, A02, A03, A04, A05', notes: 'n'.repeat(2000) });
    expect(res.status).toBe(200);
  });

  it('T-BR9-3 a Completed Visit cannot be saved or completed again, and its fields stay as they were', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId);
    expect((await request(server()).post(`/visits/${visitId}/complete`).set(as(clinical)).send(FORM)).status).toBe(200);

    const draft = await request(server()).put(`/visits/${visitId}/draft`).set(as(clinical)).send({ ...FORM, symptoms: 'Changed' });
    const again = await request(server()).post(`/visits/${visitId}/complete`).set(as(clinical)).send({ ...FORM, symptoms: 'Changed' });
    for (const res of [draft, again]) {
      expect(res.status).toBe(409);
      expect(res.body.message).toBe('This visit can no longer be changed.');
    }
    expect((await admin.from('visits').select('symptoms').eq('id', visitId).single()).data?.symptoms).toBe(FORM.symptoms);
    expect(await audits(visitId, 'completed_visit')).toBe(1);
  });

  it('a Called Visit cannot be completed without a consultation', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await addVisit(own.facilityId, 1, { status: 'Called', called_at: minutesAgo(3), called_by: clinicianId });
    expect((await request(server()).post(`/visits/${visitId}/complete`).set(as(clinical)).send(FORM)).status).toBe(409);
  });
});

describe('Correcting a finished Visit (BR9)', () => {
  it('T-EDGE-10 stays locked for everybody in the app; only admin_correct_visit changes it and logs corrected_visit', async () => {
    const { own, clinical, clinicianId } = await fresh();
    const { visitId } = await inConsultation(own, clinicianId);
    await request(server()).post(`/visits/${visitId}/complete`).set(as(clinical)).send(FORM);
    expect((await request(server()).put(`/visits/${visitId}/draft`).set(as(clinical)).send({ ...FORM, notes: 'Mistake fix' })).status).toBe(409);

    const fixed = await admin.rpc('admin_correct_visit', { p_visit_id: visitId, p_manager_id: own.accounts.Manager.id, p_field: 'notes', p_value: 'Corrected note.' });
    expect(fixed.error).toBeNull();
    const { data } = await admin.from('visits').select('notes, status').eq('id', visitId).single();
    expect(data).toEqual({ notes: 'Corrected note.', status: 'Completed' });
    expect(await audits(visitId, 'corrected_visit')).toBe(1);
  });
});
