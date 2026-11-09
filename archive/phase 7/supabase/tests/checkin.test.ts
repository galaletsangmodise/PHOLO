import { randomUUID } from 'crypto';
import {
  admin, buildSaId, checkin, createClinic, createStaff, minutesAgo, mustInsertPatient, mustInsertVisit,
  TestClinic,
} from './helpers';

let clinic: TestClinic;
const visitsOf = async (facilityId: string) =>
  (await admin.from('visits').select('id, patient_id, queue_number, status, consent_given').eq('facility_id', facilityId).order('created_at')).data ?? [];

describe('BR1 queue numbers', () => {
  beforeEach(async () => { clinic = await createClinic(); });

  it('T-BR1-1 the first Check-in of the day gets 1', async () => {
    const r = await checkin(clinic.tablet.id);
    expect(r.error).toBeNull();
    expect(r.data.queue_number).toBe(1);
  });
  it('T-BR1-2 the next two get 2 and 3', async () => {
    await checkin(clinic.tablet.id);
    const second = await checkin(clinic.tablet.id, { p_first_name: 'Bongi', p_surname: 'Two' });
    const third = await checkin(clinic.tablet.id, { p_first_name: 'Cebo', p_surname: 'Three' });
    expect([second.data.queue_number, third.data.queue_number]).toEqual([2, 3]);
  });
  it('T-BR1-3 a number is never reused that day', async () => {
    await checkin(clinic.tablet.id);
    const [first] = await visitsOf(clinic.facilityId);
    await clinic.reception.client.rpc('mark_visit_left', { p_visit_id: first.id });
    const again = await checkin(clinic.tablet.id, { p_first_name: 'Dumi', p_surname: 'Four' });
    expect(again.data.queue_number).toBe(2);
  });
  it('T-BR1-4 the first Check-in on a new SAST day gets 1', async () => {
    const patient = await mustInsertPatient(clinic.facilityId);
    await mustInsertVisit(clinic.facilityId, patient.id, 7, { checkin_at: minutesAgo(26 * 60), status: 'Left' });
    const r = await checkin(clinic.tablet.id);
    expect(r.data.queue_number).toBe(1);
  });
  it('T-BR1-5 a second Facility has separate numbers', async () => {
    const other = await createClinic();
    await checkin(clinic.tablet.id);
    await checkin(clinic.tablet.id, { p_first_name: 'Bongi', p_surname: 'Two' });
    expect((await checkin(other.tablet.id)).data.queue_number).toBe(1);
  });
});

describe('BR3 one open Visit per Patient', () => {
  beforeEach(async () => { clinic = await createClinic(); });
  const checkinAgain = async (status: string) => {
    const patient = await mustInsertPatient(clinic.facilityId, { first_name: 'Zola', surname: 'Again', date_of_birth: '1980-03-03' });
    await mustInsertVisit(clinic.facilityId, patient.id, 5, { status });
    const r = await checkin(clinic.tablet.id, { p_first_name: 'Zola', p_surname: 'Again', p_date_of_birth: '1980-03-03' });
    expect(r.error).toBeNull();
    expect(r.data).toMatchObject({ queue_number: 5, already_checked_in: true });
    expect(await visitsOf(clinic.facilityId)).toHaveLength(1);
  };
  it('T-BR3-1 Waiting returns the existing number', () => checkinAgain('Waiting'));
  it('T-BR3-2 Called returns the existing number', () => checkinAgain('Called'));
  it('T-BR3-3 In consultation returns the existing number', () => checkinAgain('In consultation'));
  it.each(['Completed', 'Left'])('T-BR3-4 when the last Visit is %s a new Visit is made', async (status) => {
    const patient = await mustInsertPatient(clinic.facilityId, { first_name: 'Zola', surname: 'Again', date_of_birth: '1980-03-03' });
    await mustInsertVisit(clinic.facilityId, patient.id, 5, status === 'Completed' ? { status, symptoms: 'x', outcome: 'Other' } : { status });
    const r = await checkin(clinic.tablet.id, { p_first_name: 'Zola', p_surname: 'Again', p_date_of_birth: '1980-03-03' });
    expect(r.data).toMatchObject({ queue_number: 6, already_checked_in: false });
  });
});

describe('BR4 finding or making the Patient', () => {
  beforeEach(async () => { clinic = await createClinic(); });
  const patientOf = async (queue: number) => {
    const visit = (await visitsOf(clinic.facilityId)).find((v) => v.queue_number === queue);
    return visit!.patient_id;
  };
  it('T-BR4-1 the same ID number links to the same Patient', async () => {
    const id = buildSaId('1985-05-05');
    const patient = await mustInsertPatient(clinic.facilityId, { first_name: 'Thabo', surname: 'Ndlovu', date_of_birth: '1985-05-05', id_number: id });
    const r = await checkin(clinic.tablet.id, { p_first_name: 'Other', p_surname: 'Name', p_date_of_birth: '1985-05-05', p_id_number: id });
    expect(r.error).toBeNull();
    expect(await patientOf(r.data.queue_number)).toBe(patient.id);
  });
  it('T-BR4-2 without an ID number, name and date of birth match ignoring capitals', async () => {
    const patient = await mustInsertPatient(clinic.facilityId, { first_name: 'Thabo', surname: 'Ndlovu', date_of_birth: '1985-05-05' });
    const r = await checkin(clinic.tablet.id, { p_first_name: 'tHABO', p_surname: 'NDLOVU', p_date_of_birth: '1985-05-05' });
    expect(await patientOf(r.data.queue_number)).toBe(patient.id);
  });
  it('T-BR4-3 the stored details are not changed by a Check-in', async () => {
    const patient = await mustInsertPatient(clinic.facilityId, { first_name: 'Thabo', surname: 'Ndlovu', date_of_birth: '1985-05-05', cellphone: '0825550001', paper_file_status: 'No paper file' });
    await checkin(clinic.tablet.id, { p_first_name: 'Thabo', p_surname: 'Ndlovu', p_date_of_birth: '1985-05-05', p_cellphone: '0825559999', p_has_file: true });
    const after = (await admin.from('patients').select('cellphone, paper_file_status, first_name').eq('id', patient.id).single()).data;
    expect(after).toEqual({ cellphone: '+27825550001', paper_file_status: 'No paper file', first_name: 'Thabo' });
  });
  it('T-BR4-4 no match makes a new Patient with the next file number (PH-000005 after four)', async () => {
    for (let i = 0; i < 4; i += 1) await mustInsertPatient(clinic.facilityId, { first_name: `Seed${'x'.repeat(i)}` });
    const r = await checkin(clinic.tablet.id);
    const patient = (await admin.from('patients').select('file_number').eq('id', await patientOf(r.data.queue_number)).single()).data;
    expect(patient?.file_number).toBe('PH-000005');
  });
  it('T-BR4-5 file answer Yes gives "Paper file - not yet digitised"', async () => {
    const r = await checkin(clinic.tablet.id, { p_has_file: true });
    const patient = (await admin.from('patients').select('paper_file_status').eq('id', await patientOf(r.data.queue_number)).single()).data;
    expect(patient?.paper_file_status).toBe('Paper file - not yet digitised');
    expect(r.data.has_file).toBe(true);
  });
  it('T-BR4-6 file answer No gives "No paper file"', async () => {
    const r = await checkin(clinic.tablet.id, { p_has_file: false });
    const patient = (await admin.from('patients').select('paper_file_status').eq('id', await patientOf(r.data.queue_number)).single()).data;
    expect(patient?.paper_file_status).toBe('No paper file');
    expect(r.data.has_file).toBe(false);
  });
  it('T-BR4-7 when an ID number and a name and date of birth match different Patients, the ID number wins', async () => {
    const id = buildSaId('1985-05-05');
    const byId = await mustInsertPatient(clinic.facilityId, { first_name: 'Thabo', surname: 'Ndlovu', date_of_birth: '1985-05-05', id_number: id });
    await mustInsertPatient(clinic.facilityId, { first_name: 'Lerato', surname: 'Mokoena', date_of_birth: '1985-05-05' });
    const r = await checkin(clinic.tablet.id, { p_first_name: 'Lerato', p_surname: 'Mokoena', p_date_of_birth: '1985-05-05', p_id_number: id });
    expect(await patientOf(r.data.queue_number)).toBe(byId.id);
  });
  it('T-BR4-8 the result holds only queue_number, already_checked_in, urgent and has_file', async () => {
    const r = await checkin(clinic.tablet.id, { p_urgent: true });
    expect(Object.keys(r.data).sort()).toEqual(['already_checked_in', 'has_file', 'queue_number', 'urgent']);
    expect(r.data.urgent).toBe(true);
  });
});

describe('T-EDGE-8 same name and date of birth, no ID number (BR4)', () => {
  beforeEach(async () => { clinic = await createClinic(); });
  it('T-EDGE-8 two people with the same name and date of birth and no ID number are one Patient, and Reception can correct the file', async () => {
    const same = { p_first_name: 'Sipho', p_surname: 'Twin', p_date_of_birth: '1990-04-04', p_id_number: null };
    const first = await checkin(clinic.tablet.id, same);
    expect(first.error).toBeNull();
    const [open] = await visitsOf(clinic.facilityId);
    await clinic.reception.client.rpc('mark_visit_left', { p_visit_id: open.id });

    const second = await checkin(clinic.tablet.id, { ...same, p_first_name: 'SIPHO', p_surname: 'twin' });
    expect(second.error).toBeNull();
    expect(second.data).toMatchObject({ already_checked_in: false });
    const visits = await visitsOf(clinic.facilityId);
    expect(visits).toHaveLength(2);
    expect(new Set(visits.map((v) => v.patient_id)).size).toBe(1);

    const fixed = await clinic.reception.client.from('patients').update({ first_name: 'Siphiwe' }).eq('id', visits[0].patient_id).select('first_name').single();
    expect(fixed.error).toBeNull();
    expect(fixed.data?.first_name).toBe('Siphiwe');
  });
});

describe('BR14 limit of 40 Check-ins in 10 minutes', () => {
  const fill = async (tabletId: string, facilityId: string, count: number, createdAt: string) => {
    const rows = Array.from({ length: count }, () => ({ facility_id: facilityId, actor_id: tabletId, action: 'checked_in', entity_type: 'Visit', entity_id: randomUUID(), created_at: createdAt }));
    const { error } = await admin.from('audit_logs').insert(rows);
    expect(error).toBeNull();
  };
  beforeEach(async () => { clinic = await createClinic(); });

  it('T-BR14-1 the 41st Check-in is refused with the exact message', async () => {
    await fill(clinic.tablet.id, clinic.facilityId, 40, new Date().toISOString());
    const r = await checkin(clinic.tablet.id);
    expect(r.error?.message).toBe('Too many Check-ins at once. Please wait one minute and try again.');
  });
  it('T-BR14-2 the 40th Check-in is accepted', async () => {
    await fill(clinic.tablet.id, clinic.facilityId, 39, new Date().toISOString());
    expect((await checkin(clinic.tablet.id)).error).toBeNull();
  });
  it('T-BR14-3 a second tablet is not affected', async () => {
    const second = await createStaff(clinic.facilityId, 'Check-in');
    await fill(clinic.tablet.id, clinic.facilityId, 40, new Date().toISOString());
    expect((await checkin(second.id)).error).toBeNull();
  });
  it('T-BR14-4 after 10 minutes a Check-in is accepted again', async () => {
    await fill(clinic.tablet.id, clinic.facilityId, 40, minutesAgo(11));
    expect((await checkin(clinic.tablet.id)).error).toBeNull();
  });
});

describe('BR17 consent', () => {
  beforeEach(async () => { clinic = await createClinic(); });
  it('T-BR17-1 consent_given false is refused', async () => {
    expect((await checkin(clinic.tablet.id, { p_consent_given: false })).error).not.toBeNull();
    expect(await visitsOf(clinic.facilityId)).toHaveLength(0);
  });
  it('T-BR17-2 consent_given true saves the Visit with consent_given = true', async () => {
    expect((await checkin(clinic.tablet.id)).error).toBeNull();
    expect((await visitsOf(clinic.facilityId))[0].consent_given).toBe(true);
  });
});
