import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SEED_EMAILS, SEED_FACILITY, TEST_PASSWORD, admin, closeVisitsOf, createApp, lettersName, makeSaId } from './helpers';

let app: INestApplication;
let reception: string;
let clinical: string;
const created: string[] = []; // Patients made here; the ones without Visits are deleted at the end
const withVisits: string[] = [];

const server = () => app.getHttpServer();
const login = async (email: string): Promise<string> =>
  (await request(server()).post('/auth/login').send({ email, password: TEST_PASSWORD })).body.session.access_token;
const as = (token: string) => ({ Authorization: `Bearer ${token}` });
const search = (token: string, q: string) => request(server()).get('/patients').query({ q }).set(as(token));
const open = (token: string, id: string) => request(server()).get(`/patients/${id}`).set(as(token));
const create = (token: string, body: Record<string, unknown>) => request(server()).post('/patients').set(as(token)).send(body);
const paperHistory = (token: string, id: string, body: Record<string, unknown>) => request(server()).patch(`/patients/${id}/paper-history`).set(as(token)).send(body);
const edit = (token: string, id: string, body: Record<string, unknown>) => request(server()).patch(`/patients/${id}`).set(as(token)).send(body);

const newPatient = (overrides: Record<string, unknown> = {}) => ({
  first_name: lettersName('Nomvula'),
  surname: lettersName('Pillay'),
  date_of_birth: '1990-03-11',
  id_number: null,
  cellphone: '083 555 0198',
  paper_file_status: 'Paper file - not yet digitised',
  ...overrides,
});

/** Inserts a Patient as the administrator (for search tests that need many). */
async function seedPatient(fields: Record<string, unknown>) {
  const { data, error } = await admin
    .from('patients')
    .insert({ facility_id: SEED_FACILITY, date_of_birth: '1980-01-01', paper_file_status: 'No paper file', ...fields })
    .select('id, file_number')
    .single();
  if (error || !data) throw new Error(error?.message ?? 'No patient');
  created.push(data.id);
  return data;
}

const auditRows = async (action: string, entityId: string) =>
  (await admin.from('audit_logs').select('actor_id, action, entity_type, facility_id').eq('action', action).eq('entity_id', entityId)).data ?? [];

beforeAll(async () => {
  app = await createApp();
  reception = await login(SEED_EMAILS.Reception);
  clinical = await login(SEED_EMAILS.Clinical);
}, 60000);

afterAll(async () => {
  await closeVisitsOf(withVisits);
  const removable = created.filter((id) => !withVisits.includes(id));
  if (removable.length > 0) await admin.from('patients').delete().in('id', removable);
  await app.close();
});

describe('OP9 search (BR13, T-US4, T-INT-13)', () => {
  it('T-US4-1, T-BR13-2 "Dlamini", "dla" and "tha" find Thandi Dlamini with her file number, ignoring capitals', async () => {
    for (const text of ['Dlamini', 'dla', 'THA', 'tha']) {
      const res = await search(reception, text);
      expect(res.status).toBe(200);
      const thandi = res.body.patients.find((p: { first_name: string; surname: string }) => p.first_name === 'Thandi' && p.surname === 'Dlamini');
      expect(thandi).toMatchObject({ file_number: 'PH-000003', date_of_birth: '1997-08-14', id_number_last4: '4088', paper_file_status: 'No paper file' });
    }
  });

  it('T-US4-2 a search with no match gives an empty list', async () => {
    const res = await search(reception, 'Zzzzqq');
    expect(res.status).toBe(200);
    expect(res.body.patients).toEqual([]);
  });

  it('T-BR13-1, T-INT-13 one character comes back with "Type at least 2 characters to search."', async () => {
    for (const text of ['a', ' a ', '']) {
      const res = await search(reception, text);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Type at least 2 characters to search.');
    }
    expect((await request(server()).get('/patients').set(as(reception))).body.message).toBe('Type at least 2 characters to search.');
  });

  it('T-BR13-3 an exact 13-digit ID number finds that Patient, and only the last 4 digits are returned', async () => {
    const res = await search(reception, '9708140234088');
    expect(res.body.patients).toHaveLength(1);
    expect(res.body.patients[0]).toMatchObject({ first_name: 'Thandi', id_number_last4: '4088' });
    expect(JSON.stringify(res.body)).not.toContain('9708140234088');
  });

  it('T-BR13-4 an exact file number finds that Patient', async () => {
    const res = await search(clinical, 'PH-000003');
    expect(res.body.patients).toHaveLength(1);
    expect(res.body.patients[0]).toMatchObject({ first_name: 'Thandi', surname: 'Dlamini' });
    expect((await search(clinical, 'ph-000003')).body.patients).toHaveLength(1);
  });

  it('T-BR13-5 with more than 20 matches at most 20 come back', async () => {
    const stem = lettersName('Manymatch');
    for (let i = 0; i < 22; i += 1) await seedPatient({ first_name: 'Testperson', surname: `${stem}${'abcdefghijklmnopqrstuvwxyz'[i]}` });
    const res = await search(reception, stem);
    expect(res.body.patients).toHaveLength(20);
  });

  it('T-BR13-6 matches are sorted by surname, then first name', async () => {
    const stem = lettersName('Sortcheck');
    await seedPatient({ first_name: 'Zane', surname: `${stem}b` });
    await seedPatient({ first_name: 'Bongi', surname: `${stem}b` });
    await seedPatient({ first_name: 'Cebo', surname: `${stem}a` });
    const res = await search(reception, stem);
    expect(res.body.patients.map((p: { surname: string; first_name: string }) => `${p.surname.slice(-1)}-${p.first_name}`)).toEqual(['a-Cebo', 'b-Bongi', 'b-Zane']);
  });

  it('a name with % or _ is taken as plain characters', async () => {
    const res = await search(reception, 'D%');
    expect(res.status).toBe(200);
    expect(res.body.patients).toEqual([]);
  });
});

describe('OP10 open a Patient File (T-INT-5, T-US12-1, T-BR16-2)', () => {
  it('T-INT-5 writes opened_patient_file and a Reception answer holds no clinical field', async () => {
    const patient = await seedPatient({ first_name: lettersName('Fileopen'), surname: lettersName('Visitor') });
    const { data: visit } = await admin
      .from('visits')
      .insert({ facility_id: SEED_FACILITY, patient_id: patient.id, queue_number: 9000 + Math.floor(Math.random() * 900), reason_category: 'Test or screening', consent_given: true, status: 'Waiting', symptoms: 'Secret symptoms', notes: 'Secret notes', icd10_codes: 'J06.9', outcome: 'Other' })
      .select('id')
      .single();
    expect(visit).not.toBeNull();
    withVisits.push(patient.id);

    const res = await open(reception, patient.id);
    expect(res.status).toBe(200);
    expect(res.body.patient).toMatchObject({ id: patient.id, file_number: patient.file_number });
    expect(res.body.visits).toHaveLength(1);
    expect(Object.keys(res.body.visits[0]).sort()).toEqual(['checkin_at', 'id', 'queue_number', 'reason_category', 'status', 'urgent']);
    const text = JSON.stringify(res.body);
    for (const secret of ['Secret symptoms', 'Secret notes', 'J06.9', 'symptoms', 'notes', 'icd10_codes', 'outcome']) expect(text).not.toContain(secret);

    const rows = await auditRows('opened_patient_file', patient.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ entity_type: 'Patient', facility_id: SEED_FACILITY });
  });

  it('Clinical opens a file too, and the Visits are newest first', async () => {
    const patient = await seedPatient({ first_name: lettersName('Twovisits'), surname: lettersName('Newest') });
    const base = { facility_id: SEED_FACILITY, patient_id: patient.id, reason_category: 'Test or screening', consent_given: true, status: 'Left', left_at: new Date().toISOString() };
    await admin.from('visits').insert([
      { ...base, queue_number: 9100 + Math.floor(Math.random() * 400), checkin_at: '2026-10-01T05:00:00Z' },
      { ...base, queue_number: 9500 + Math.floor(Math.random() * 400), checkin_at: '2026-10-02T05:00:00Z' },
    ]);
    withVisits.push(patient.id);
    const res = await open(clinical, patient.id);
    expect(res.status).toBe(200);
    expect(res.body.visits.map((v: { checkin_at: string }) => v.checkin_at.slice(0, 10))).toEqual(['2026-10-02', '2026-10-01']);
  });

  it('T-INT-13 a missing or invalid id comes back with "We could not open this file. Please try again." and no AuditLog row', async () => {
    const missing = await open(reception, '00000000-0000-4000-8000-0000000000ff');
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('We could not open this file. Please try again.');
    expect((await open(reception, 'not-an-id')).status).toBe(404);
    expect(await auditRows('opened_patient_file', '00000000-0000-4000-8000-0000000000ff')).toHaveLength(0);
  });
});

describe('OP11 create a Patient (T-INT-6, T-US14, T-BR16-2)', () => {
  it('T-INT-6 Reception creates a Patient: next file number, +27 cellphone, AuditLog created_patient', async () => {
    const body = newPatient();
    const res = await create(reception, body);
    expect(res.status).toBe(201);
    created.push(res.body.id);
    expect(res.body).toMatchObject({ first_name: body.first_name, surname: body.surname, cellphone: '+27835550198', id_number: null, paper_file_status: 'Paper file - not yet digitised' });
    expect(res.body.file_number).toMatch(/^PH-[0-9]{6}$/);

    const { data: others } = await admin.from('patients').select('file_number').eq('facility_id', SEED_FACILITY).neq('id', res.body.id);
    expect(others?.every((p) => p.file_number < res.body.file_number)).toBe(true);
    const rows = await auditRows('created_patient', res.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_type).toBe('Patient');
  });

  it('T-INT-6 Clinical is refused', async () => {
    const body = newPatient();
    const res = await create(clinical, body);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('You are not allowed to open this page.');
    expect((await admin.from('patients').select('id', { count: 'exact', head: true }).eq('first_name', body.first_name as string)).count).toBe(0);
  });

  it('T-US14-2, T-INT-13 invalid input comes back with the exact messages and nothing is saved', async () => {
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ first_name: '' }, 'first_name', 'Please enter the first name.'],
      [{ surname: '' }, 'surname', 'Please enter the surname.'],
      [{ date_of_birth: '' }, 'date_of_birth', 'Please enter a real date of birth, for example 14 / 08 / 1997.'],
      [{ date_of_birth: '2999-01-01' }, 'date_of_birth', 'Please enter a real date of birth, for example 14 / 08 / 1997.'],
      [{ id_number: '1234567890123' }, 'id_number', 'This ID number does not look right. Check it, or leave it empty if the patient does not have one.'],
      [{ cellphone: '555' }, 'cellphone', 'Enter a South African cellphone number, for example 083 555 0198, or leave it empty.'],
      [{ paper_file_status: '' }, 'paper_file_status', 'Please choose a paper file status.'],
    ];
    for (const [patch, field, message] of cases) {
      const body = newPatient(patch);
      const res = await create(reception, body);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ message, field });
      expect((await admin.from('patients').select('id', { count: 'exact', head: true }).eq('surname', body.surname as string)).count).toBe(0);
    }
  });

  it('T-US5-2 an ID number that already exists is refused with the message and the existing file id', async () => {
    const res = await create(reception, newPatient({ date_of_birth: '1997-08-14', id_number: '9708140234088' }));
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A patient with this ID number already exists. Open their file instead.');
    const { data: thandi } = await admin.from('patients').select('id').eq('file_number', 'PH-000003').eq('facility_id', SEED_FACILITY).single();
    expect(res.body.existing_patient_id).toBe(thandi?.id);
  });
});

describe('OP12 edit details (T-INT-7, T-US5, T-BR16-2)', () => {
  it('T-US5-1, T-INT-7 changes the details, never the file number, and writes updated_patient (Reception and Clinical)', async () => {
    const patient = await seedPatient({ first_name: lettersName('Editme'), surname: lettersName('Details'), cellphone: '+27825550001' });
    const body = { first_name: lettersName('Edited'), surname: lettersName('Changed'), date_of_birth: '1981-02-02', id_number: makeSaId('1981-02-02', '5111'), cellphone: '082 555 0147', file_number: 'PH-999999', paper_file_status: 'Paper file - digitised' };
    const res = await edit(reception, patient.id, body);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: patient.id, first_name: body.first_name, surname: body.surname, cellphone: '+27825550147', file_number: patient.file_number, paper_file_status: 'No paper file' });
    expect(await auditRows('updated_patient', patient.id)).toHaveLength(1);

    const again = await edit(clinical, patient.id, { ...body, cellphone: '+27825550148' });
    expect(again.status).toBe(200);
    expect(again.body.cellphone).toBe('+27825550148');
    expect(await auditRows('updated_patient', patient.id)).toHaveLength(2);
    const { data: stored } = await admin.from('patients').select('file_number, cellphone').eq('id', patient.id).single();
    expect(stored).toEqual({ file_number: patient.file_number, cellphone: '+27825550148' });
  });

  it('T-US5-2 an ID number that belongs to another Patient is refused, with the existing file id, and nothing is saved', async () => {
    const patient = await seedPatient({ first_name: lettersName('Dupid'), surname: lettersName('Edit'), date_of_birth: '1954-05-03' });
    const res = await edit(reception, patient.id, { first_name: 'Dupid', surname: 'Edit', date_of_birth: '1954-05-03', id_number: '5405035121082', cellphone: null });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('A patient with this ID number already exists. Open their file instead.');
    expect(res.body.existing_patient_id).toEqual(expect.any(String));
    expect((await admin.from('patients').select('id_number').eq('id', patient.id).single()).data?.id_number).toBeNull();
    expect(await auditRows('updated_patient', patient.id)).toHaveLength(0);
  });

  it('T-INT-13 invalid input comes back with the exact message', async () => {
    const patient = await seedPatient({ first_name: lettersName('Badedit'), surname: lettersName('Input') });
    const res = await edit(reception, patient.id, { first_name: 'Badedit', surname: '', date_of_birth: '1980-01-01', id_number: null, cellphone: null });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ message: 'Please enter the surname.', field: 'surname' });
  });

  it('an unknown Patient is "We could not open this file. Please try again."', async () => {
    const res = await edit(reception, '00000000-0000-4000-8000-0000000000ff', { first_name: 'A', surname: 'B', date_of_birth: '1980-01-01', id_number: null, cellphone: null });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('We could not open this file. Please try again.');
  });
});

describe('T-EDGE-8 two people with the same name and date of birth and no ID number are one Patient (BR4)', () => {
  it('the second Check-in joins the first Patient; Reception sees both Visits on one file and can correct the details', async () => {
    const tablet = await login(SEED_EMAILS['Check-in']);
    const first = lettersName('Sameperson');
    const surname = lettersName('Samename');
    const body = { first_name: first, surname, date_of_birth: '1992-06-06', id_number: null, cellphone: null, has_file: false, assisted: false, reason_category: 'Test or screening', urgent: false, consent_given: true };
    expect((await request(server()).post('/checkin').set(as(tablet)).send(body)).status).toBe(200);
    const { data: patient } = await admin.from('patients').select('id').eq('first_name', first).eq('surname', surname).single();
    expect(patient).not.toBeNull();
    created.push(patient!.id);
    withVisits.push(patient!.id);
    await closeVisitsOf([patient!.id]);

    expect((await request(server()).post('/checkin').set(as(tablet)).send({ ...body, first_name: first.toUpperCase() })).status).toBe(200);
    expect((await admin.from('patients').select('id', { count: 'exact', head: true }).eq('surname', surname)).count).toBe(1);

    const file = await open(reception, patient!.id);
    expect(file.body.visits).toHaveLength(2);
    const fixed = await edit(reception, patient!.id, { first_name: `${first}z`, surname, date_of_birth: '1992-06-06', id_number: null, cellphone: null });
    expect(fixed.status).toBe(200);
  });
});

describe('T-BR16-2 an AuditLog row exists for each action of OP10, OP11 and OP12', () => {
  it('opened_patient_file, created_patient and updated_patient are written for the acting user', async () => {
    const res = await create(reception, newPatient());
    created.push(res.body.id);
    await open(clinical, res.body.id);
    await edit(reception, res.body.id, { first_name: res.body.first_name, surname: res.body.surname, date_of_birth: '1990-03-11', id_number: null, cellphone: null });
    const { data: reader } = await admin.from('staff_profiles').select('id').eq('full_name', 'Nomsa Khumalo').single();
    const { data: writer } = await admin.from('staff_profiles').select('id').eq('full_name', 'Busisiwe Naidoo').single();
    expect((await auditRows('created_patient', res.body.id))[0].actor_id).toBe(writer?.id);
    expect((await auditRows('opened_patient_file', res.body.id))[0].actor_id).toBe(reader?.id);
    expect((await auditRows('updated_patient', res.body.id))[0].actor_id).toBe(writer?.id);
  });
});

describe('OP13 record paper file history (T-US14-1, T-US15, T-BR18, T-INT-20)', () => {
  const statusOf = async (id: string) => (await admin.from('patients').select('paper_file_status, chronic_conditions, allergies, current_medication, file_number').eq('id', id).single()).data!;

  it('T-US14-1 Reception creates a Patient with "Paper file - not yet digitised" and the new file opens with that status', async () => {
    const res = await create(reception, newPatient());
    expect(res.status).toBe(201);
    created.push(res.body.id);
    expect(res.body.paper_file_status).toBe('Paper file - not yet digitised');
    expect((await open(reception, res.body.id)).body.patient.paper_file_status).toBe('Paper file - not yet digitised');
  });

  it('T-US15-1, T-INT-20 "Penicillin" with the box ticked: the Patient changes, the status is "Paper file - digitised" and recorded_paper_history exists', async () => {
    const made = await create(reception, newPatient());
    created.push(made.body.id);
    const res = await paperHistory(reception, made.body.id, { chronic_conditions: '', allergies: 'Penicillin', current_medication: '', mark_digitised: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: made.body.id, allergies: 'Penicillin', chronic_conditions: null, current_medication: null, paper_file_status: 'Paper file - digitised', file_number: made.body.file_number });
    expect(await statusOf(made.body.id)).toMatchObject({ allergies: 'Penicillin', paper_file_status: 'Paper file - digitised' });
    const rows = await auditRows('recorded_paper_history', made.body.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].entity_type).toBe('Patient');
    const { data: writer } = await admin.from('staff_profiles').select('id').eq('full_name', 'Busisiwe Naidoo').single();
    expect(rows[0].actor_id).toBe(writer?.id);
    expect((await open(clinical, made.body.id)).body.patient.allergies).toBe('Penicillin');
  });

  it('T-US15-2, T-BR18-1 the box ticked with all three fields empty is refused with the exact message and nothing is saved or logged', async () => {
    const made = await create(reception, newPatient());
    created.push(made.body.id);
    const res = await paperHistory(reception, made.body.id, { chronic_conditions: '', allergies: '   ', current_medication: '', mark_digitised: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Add at least one item from the paper file before marking it as digitised.');
    expect(await statusOf(made.body.id)).toMatchObject({ paper_file_status: 'Paper file - not yet digitised', allergies: null });
    expect(await auditRows('recorded_paper_history', made.body.id)).toHaveLength(0);
  });

  it('T-BR18-2 the status becomes digitised only from "not yet digitised": from "No paper file" the request is refused and nothing is saved', async () => {
    const made = await create(reception, newPatient({ paper_file_status: 'No paper file' }));
    created.push(made.body.id);
    const res = await paperHistory(reception, made.body.id, { chronic_conditions: 'Hypertension', allergies: '', current_medication: '', mark_digitised: true });
    expect(res.status).toBe(400);
    expect(await statusOf(made.body.id)).toMatchObject({ paper_file_status: 'No paper file', chronic_conditions: null });
    expect(await auditRows('recorded_paper_history', made.body.id)).toHaveLength(0);
  });

  it('the history can be saved without the box: the status stays, and "No paper file" Patients can have history typed too', async () => {
    const pending = await create(reception, newPatient());
    created.push(pending.body.id);
    const res = await paperHistory(reception, pending.body.id, { chronic_conditions: '', allergies: 'None known', current_medication: '', mark_digitised: false });
    expect(res.status).toBe(200);
    expect(res.body.paper_file_status).toBe('Paper file - not yet digitised');
    const none = await create(reception, newPatient({ paper_file_status: 'No paper file' }));
    created.push(none.body.id);
    expect((await paperHistory(reception, none.body.id, { chronic_conditions: 'Asthma', allergies: '', current_medication: '', mark_digitised: false })).status).toBe(200);
  });

  it('T-BR18-3 Reception and Clinical can both digitise a file', async () => {
    for (const token of [reception, clinical]) {
      const made = await create(reception, newPatient());
      created.push(made.body.id);
      const res = await paperHistory(token, made.body.id, { chronic_conditions: 'Hypertension', allergies: '', current_medication: '', mark_digitised: true });
      expect(res.status).toBe(200);
      expect(res.body.paper_file_status).toBe('Paper file - digitised');
    }
  });

  it('T-BR18-4 the file number never changes, whatever the request holds', async () => {
    const made = await create(reception, newPatient());
    created.push(made.body.id);
    const res = await paperHistory(reception, made.body.id, { chronic_conditions: 'Hypertension', allergies: '', current_medication: '', mark_digitised: false, file_number: 'PH-999999' });
    expect(res.status).toBe(200);
    expect(res.body.file_number).toBe(made.body.file_number);
    expect((await statusOf(made.body.id)).file_number).toBe(made.body.file_number);
  });

  it('T-INT-13 a text that is too long comes back with its exact message and nothing is saved', async () => {
    const made = await create(reception, newPatient());
    created.push(made.body.id);
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ chronic_conditions: 'x'.repeat(501) }, 'Chronic conditions can be at most 500 characters.'],
      [{ allergies: 'x'.repeat(301) }, 'Allergies can be at most 300 characters.'],
      [{ current_medication: 'x'.repeat(501) }, 'Current medication can be at most 500 characters.'],
    ];
    for (const [patch, message] of cases) {
      const res = await paperHistory(reception, made.body.id, { chronic_conditions: '', allergies: '', current_medication: '', mark_digitised: false, ...patch });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe(message);
    }
    expect(await auditRows('recorded_paper_history', made.body.id)).toHaveLength(0);
  });

  it('an unknown Patient is "We could not open this file. Please try again."', async () => {
    const res = await paperHistory(reception, '00000000-0000-4000-8000-0000000000ff', { chronic_conditions: 'x', allergies: '', current_medication: '', mark_digitised: false });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('We could not open this file. Please try again.');
  });
});
