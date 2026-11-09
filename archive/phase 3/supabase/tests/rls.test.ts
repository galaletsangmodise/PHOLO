import {
  admin, catalog, createClinic, createFacility, createStaff, mustInsertPatient, mustInsertVisit, signInSeed,
  checkin, SEED, TestClinic,
} from './helpers';
import type { SupabaseClient } from '@supabase/supabase-js';

type Result = { data: unknown; error: unknown };
const rowsOf = (r: Result): unknown[] => (Array.isArray(r.data) ? r.data : r.data ? [r.data] : []);
/** A denied action either returns an error or touches no row (row-level security hides the rows). */
const denied = (r: Result) => expect(r.error !== null || rowsOf(r).length === 0).toBe(true);
const allowed = (r: Result) => { expect(r.error).toBeNull(); expect(rowsOf(r).length).toBeGreaterThan(0); };

let seed: { tablet: SupabaseClient; reception: SupabaseClient; clinical: SupabaseClient; manager: SupabaseClient };
let other: TestClinic; // a second Facility
let own: TestClinic; // a Facility whose data these tests may change

beforeAll(async () => {
  const [tablet, reception, clinical, manager] = await Promise.all(
    (['tablet', 'reception', 'clinical', 'manager'] as const).map((role) => signInSeed(role)),
  );
  seed = { tablet, reception, clinical, manager };
  [other, own] = await Promise.all([createClinic(), createClinic()]);
});

describe('T-DB-17 row-level security', () => {
  it('T-DB-17 every public table has RLS on and at least one policy', async () => {
    const { tables } = await catalog();
    expect(tables.length).toBeGreaterThan(0);
    tables.forEach((t) => {
      expect({ table: t.name, rls: t.rls }).toEqual({ table: t.name, rls: true });
      expect({ table: t.name, hasPolicy: t.policies > 0 }).toEqual({ table: t.name, hasPolicy: true });
    });
  });
});

describe('SEC1 / SEC2 facilities', () => {
  it('T-SEC-1a every role reads its own Facility name only', async () => {
    for (const client of Object.values(seed)) {
      const r = await client.from('facilities').select('id, name');
      expect(r.error).toBeNull();
      expect(r.data).toEqual([{ id: SEED.facility, name: 'Ubuntu Community Clinic' }]);
    }
  });
  it('T-SEC-1b no role reads the address, province or another Facility', async () => {
    expect((await seed.manager.from('facilities').select('address')).error).not.toBeNull();
    denied(await seed.manager.from('facilities').select('name').eq('id', other.facilityId));
  });
  it('T-SEC-2a the administrator creates, updates and deletes a Facility', async () => {
    const id = await createFacility();
    expect((await admin.from('facilities').update({ address: '2 Test Street' }).eq('id', id)).error).toBeNull();
    expect((await admin.from('facilities').delete().eq('id', id)).error).toBeNull();
  });
  it('T-SEC-2b no app role creates, updates or deletes a Facility', async () => {
    for (const client of Object.values(seed)) {
      expect((await client.from('facilities').insert({ name: 'Rogue', address: 'x', province: 'Gauteng' })).error).not.toBeNull();
      denied(await client.from('facilities').update({ name: 'Renamed' }).eq('id', SEED.facility).select());
      denied(await client.from('facilities').delete().eq('id', SEED.facility).select());
    }
  });
});

describe('SEC3 / SEC4 staff_profiles', () => {
  it('T-SEC-3a each user reads their own row; Clinical and Reception read the name of staff linked to Visits', async () => {
    const mine = await seed.manager.from('staff_profiles').select('id, full_name');
    expect(mine.data).toEqual([{ id: SEED.manager, full_name: 'Farouk Patel' }]);
    const names = await seed.reception.from('staff_profiles').select('full_name');
    expect((names.data ?? []).map((s: { full_name: string }) => s.full_name)).toContain('Nomsa Khumalo');
  });
  it('T-SEC-3b nobody reads other staff or another Facility', async () => {
    const r = await seed.manager.from('staff_profiles').select('full_name');
    expect((r.data ?? []).length).toBe(1);
    const tablet = await seed.tablet.from('staff_profiles').select('full_name');
    expect((tablet.data ?? []).length).toBe(1);
    denied(await seed.clinical.from('staff_profiles').select('id').eq('id', other.manager.id));
  });
  it('T-SEC-4a the administrator disables an account', async () => {
    const staff = await createStaff(own.facilityId, 'Reception');
    expect((await admin.from('staff_profiles').update({ active: false }).eq('id', staff.id)).error).toBeNull();
  });
  it('T-SEC-4b no app role creates, updates or deletes a StaffProfile', async () => {
    for (const client of Object.values(seed)) {
      expect((await client.from('staff_profiles').insert({ id: SEED.manager, facility_id: SEED.facility, full_name: 'x', role: 'Manager' })).error).not.toBeNull();
      denied(await client.from('staff_profiles').update({ role: 'Manager' }).eq('id', SEED.reception).select());
      denied(await client.from('staff_profiles').delete().eq('id', SEED.reception).select());
    }
  });
});

describe('SEC5 - SEC9 patients', () => {
  it('T-SEC-5a Reception and Clinical read the Patients of their Facility', async () => {
    for (const client of [seed.reception, seed.clinical]) {
      const r = await client.from('patients').select('file_number').eq('facility_id', SEED.facility);
      expect((r.data ?? []).length).toBeGreaterThanOrEqual(4);
    }
  });
  it('T-SEC-5b Check-in and Manager read none; nobody reads another Facility', async () => {
    denied(await seed.tablet.from('patients').select('id'));
    denied(await seed.manager.from('patients').select('id'));
    denied(await seed.reception.from('patients').select('id').eq('facility_id', other.facilityId));
  });
  it('T-SEC-6a Reception creates a Patient (the number is given by the database) and Check-in creates one through checkin', async () => {
    const r = await own.reception.client.from('patients').insert({ facility_id: own.facilityId, first_name: 'Lindiwe', surname: 'Sithole', date_of_birth: '1990-01-01', file_number: 'PH-000777' }).select('file_number');
    expect(r.error).toBeNull();
    expect(r.data?.[0].file_number).toMatch(/^PH-0000[0-9]{2}$/);
    expect(r.data?.[0].file_number).not.toBe('PH-000777');
    const c = await checkin(own.tablet.id, { p_first_name: 'Check', p_surname: 'Inner' });
    expect(c.error).toBeNull();
  });
  it('T-SEC-6b Clinical, Manager and Check-in cannot create a Patient; Reception cannot create in another Facility', async () => {
    const row = { first_name: 'Rogue', surname: 'Row', date_of_birth: '1990-01-01' };
    for (const account of [own.clinical, own.manager, own.tablet]) {
      expect((await account.client.from('patients').insert({ facility_id: own.facilityId, ...row })).error).not.toBeNull();
    }
    expect((await own.reception.client.from('patients').insert({ facility_id: other.facilityId, ...row })).error).not.toBeNull();
  });
  it('T-SEC-7a Reception and Clinical update a Patient; the file number never changes', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    for (const account of [own.reception, own.clinical]) {
      allowed(await account.client.from('patients').update({ allergies: 'Penicillin' }).eq('id', patient.id).select());
    }
    expect((await own.reception.client.from('patients').update({ file_number: 'PH-000999' }).eq('id', patient.id)).error).not.toBeNull();
  });
  it('T-SEC-7b Manager, Check-in and other Facilities cannot update a Patient', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    for (const account of [own.manager, own.tablet, other.reception]) {
      denied(await account.client.from('patients').update({ allergies: 'x' }).eq('id', patient.id).select());
    }
  });
  it('T-SEC-8a Reception and Clinical mark a paper file digitised once history is filled in', async () => {
    for (const account of [own.reception, own.clinical]) {
      const patient = await mustInsertPatient(own.facilityId, { paper_file_status: 'Paper file - not yet digitised' });
      allowed(await account.client.from('patients').update({ allergies: 'None known', paper_file_status: 'Paper file - digitised' }).eq('id', patient.id).select());
    }
  });
  it('T-SEC-8b nobody marks it digitised with all history empty', async () => {
    for (const account of [own.reception, own.clinical]) {
      const patient = await mustInsertPatient(own.facilityId, { paper_file_status: 'Paper file - not yet digitised' });
      expect((await account.client.from('patients').update({ paper_file_status: 'Paper file - digitised' }).eq('id', patient.id)).error).not.toBeNull();
    }
  });
  it('T-SEC-9a the administrator deletes a Patient who has no Visit', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    expect((await admin.from('patients').delete().eq('id', patient.id)).error).toBeNull();
  });
  it('T-SEC-9b no app role deletes a Patient', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    for (const account of [own.reception, own.clinical, own.manager, own.tablet]) {
      denied(await account.client.from('patients').delete().eq('id', patient.id).select());
    }
    expect((await admin.from('patients').select('id').eq('id', patient.id)).data).toHaveLength(1);
  });
});

describe('SEC10 - SEC13 reading Visits', () => {
  it('T-SEC-10a Clinical reads all fields of Visits of their Facility', async () => {
    const r = await seed.clinical.from('visits').select('symptoms, notes, icd10_codes, outcome').eq('id', SEED.visit1);
    expect(r.data).toEqual([{ symptoms: 'Monthly medication check. No new complaints.', notes: 'Blood pressure 138/86. Repeat prescription for 28 days.', icd10_codes: 'I10', outcome: 'Medication given' }]);
  });
  it('T-SEC-10b Reception, Manager and Check-in read nothing from visits; other Facilities read nothing', async () => {
    for (const client of [seed.reception, seed.manager, seed.tablet, other.clinical.client]) {
      denied(await client.from('visits').select('id').eq('facility_id', SEED.facility));
    }
  });
  it('T-SEC-11a Reception reads Visits through the view', async () => {
    const r = await seed.reception.from('visits_for_reception').select('queue_number, status').order('queue_number');
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(4);
  });
  it('T-SEC-11b the view has no symptoms, notes, icd10_codes or outcome, and gives Manager, Check-in and other Facilities nothing', async () => {
    for (const column of ['symptoms', 'notes', 'icd10_codes', 'outcome']) {
      expect((await seed.reception.from('visits_for_reception').select(column)).error).not.toBeNull();
    }
    denied(await seed.manager.from('visits_for_reception').select('id'));
    denied(await seed.tablet.from('visits_for_reception').select('id'));
    denied(await other.reception.client.from('visits_for_reception').select('id').eq('facility_id', SEED.facility));
  });
  it('T-SEC-12a the Manager sees counts only, through daily_summary', async () => {
    const r = await seed.manager.rpc('daily_summary');
    expect(r.error).toBeNull();
    expect(r.data).toHaveProperty('checked_in');
    expect(JSON.stringify(r.data)).not.toMatch(/Mokoena|Nkosi|Dlamini|Molefe/);
  });
  it('T-SEC-12b Manager and Check-in cannot read Visits', async () => {
    denied(await seed.manager.from('visits').select('id'));
    denied(await seed.tablet.from('visits').select('id'));
  });
});

describe('SEC13 - SEC17 changing Visits', () => {
  it('T-SEC-13a Visits are created by the checkin function', async () => {
    const r = await checkin(own.tablet.id, { p_first_name: 'Visit', p_surname: 'Maker' });
    expect(r.error).toBeNull();
    expect(r.data.queue_number).toBeGreaterThanOrEqual(1);
  });
  it('T-SEC-13b no app role inserts a Visit directly', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    for (const account of [own.reception, own.clinical, own.manager, own.tablet]) {
      expect((await account.client.from('visits').insert({ facility_id: own.facilityId, patient_id: patient.id, queue_number: 99, reason_category: 'Test or screening', consent_given: true })).error).not.toBeNull();
    }
  });
  it('T-SEC-14a Clinical calls, starts, saves a draft and completes', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    const visit = await mustInsertVisit(own.facilityId, patient.id, 41);
    const call = await own.clinical.client.rpc('call_next_patient');
    expect(call.error).toBeNull();
    expect(call.data.visit_id).toBeDefined();
    const id = call.data.visit_id;
    allowed(await own.clinical.client.from('visits').update({ status: 'In consultation' }).eq('id', id).select());
    allowed(await own.clinical.client.from('visits').update({ symptoms: 'Cough' }).eq('id', id).select());
    allowed(await own.clinical.client.from('visits').update({ status: 'Completed', symptoms: 'Cough', outcome: 'Treated and sent home' }).eq('id', id).select());
    expect(visit.id).toBeDefined();
  });
  it('T-SEC-14b Reception, Manager, Check-in and other Facilities cannot call, start, save or complete', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    const visit = await mustInsertVisit(own.facilityId, patient.id, 42, { status: 'In consultation' });
    for (const account of [own.reception, own.manager, own.tablet, other.clinical]) {
      denied(await account.client.from('visits').update({ symptoms: 'x' }).eq('id', visit.id).select());
      denied(await account.client.from('visits').update({ status: 'Completed', symptoms: 'x', outcome: 'Other' }).eq('id', visit.id).select());
    }
    for (const account of [own.reception, own.manager, own.tablet]) {
      expect((await account.client.rpc('call_next_patient')).error).not.toBeNull();
    }
  });
  it('T-SEC-15a Reception and Clinical mark a Waiting or Called Visit as left', async () => {
    for (const account of [own.reception, own.clinical]) {
      const patient = await mustInsertPatient(own.facilityId);
      const visit = await mustInsertVisit(own.facilityId, patient.id, 100 + Math.floor(Math.random() * 800));
      expect((await account.client.rpc('mark_visit_left', { p_visit_id: visit.id })).error).toBeNull();
      expect((await admin.from('visits').select('status, left_at').eq('id', visit.id).single()).data).toMatchObject({ status: 'Left' });
    }
  });
  it('T-SEC-15b Manager, Check-in and other Facilities cannot; nobody marks an In consultation Visit as left', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    const waiting = await mustInsertVisit(own.facilityId, patient.id, 43);
    for (const account of [own.manager, own.tablet, other.reception]) {
      expect((await account.client.rpc('mark_visit_left', { p_visit_id: waiting.id })).error).not.toBeNull();
    }
    const p2 = await mustInsertPatient(own.facilityId);
    const consult = await mustInsertVisit(own.facilityId, p2.id, 44, { status: 'In consultation' });
    for (const account of [own.reception, own.clinical]) {
      expect((await account.client.rpc('mark_visit_left', { p_visit_id: consult.id })).error).not.toBeNull();
    }
  });
  it('T-SEC-16a the administrator corrects a Completed Visit through admin_correct_visit', async () => {
    const r = await admin.rpc('admin_correct_visit', { p_visit_id: SEED.visit1, p_manager_id: SEED.manager, p_field: 'notes', p_value: 'Blood pressure 138/86. Repeat prescription for 28 days.' });
    expect(r.error).toBeNull();
  });
  it('T-SEC-16b no app role changes a Completed Visit', async () => {
    for (const client of [seed.clinical, seed.reception, seed.manager]) {
      denied(await client.from('visits').update({ notes: 'Changed' }).eq('id', SEED.visit1).select());
    }
    const after = await admin.from('visits').select('outcome').eq('id', SEED.visit1).single();
    expect(after.data?.outcome).toBe('Medication given');
  });
  it('T-SEC-17a the administrator deletes a Visit', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    const visit = await mustInsertVisit(own.facilityId, patient.id, 46);
    expect((await admin.from('visits').delete().eq('id', visit.id)).error).toBeNull();
  });
  it('T-SEC-17b no app role deletes a Visit', async () => {
    for (const client of [seed.clinical, seed.reception, seed.manager, seed.tablet]) {
      denied(await client.from('visits').delete().eq('id', SEED.visit4).select());
    }
    expect((await admin.from('visits').select('id').eq('id', SEED.visit4)).data).toHaveLength(1);
  });
});

describe('SEC18 - SEC20 audit_logs', () => {
  const entity = SEED.visit1;
  const entry = (actor: string) => ({ p_facility_id: SEED.facility, p_actor_id: actor, p_action: 'called_next', p_entity_type: 'Visit', p_entity_id: entity });
  it('T-SEC-18a the service role writes through write_audit', async () => {
    expect((await admin.rpc('write_audit', entry(SEED.clinical))).error).toBeNull();
  });
  it('T-SEC-18b no app role writes a row or calls write_audit', async () => {
    for (const client of Object.values(seed)) {
      expect((await client.rpc('write_audit', entry(SEED.clinical))).error).not.toBeNull();
      expect((await client.from('audit_logs').insert({ facility_id: SEED.facility, actor_id: SEED.clinical, action: 'called_next', entity_type: 'Visit', entity_id: entity })).error).not.toBeNull();
    }
  });
  it('T-SEC-19a the administrator reads the audit log', async () => {
    const r = await admin.from('audit_logs').select('id').limit(1);
    expect(r.error).toBeNull();
    expect(r.data?.length).toBe(1);
  });
  it('T-SEC-19b no app role reads the audit log', async () => {
    for (const client of Object.values(seed)) denied(await client.from('audit_logs').select('id'));
  });
  it('T-SEC-20a rows can be added (the append in SEC18a) and stay readable', async () => {
    const { count } = await admin.from('audit_logs').select('id', { count: 'exact', head: true });
    expect(count).toBeGreaterThan(0);
  });
  it('T-SEC-20b nobody updates or deletes a row, not even the service role', async () => {
    const row = (await admin.from('audit_logs').select('id').limit(1).single()).data!;
    expect((await admin.from('audit_logs').update({ action: 'marked_left' }).eq('id', row.id)).error).not.toBeNull();
    expect((await admin.from('audit_logs').delete().eq('id', row.id)).error).not.toBeNull();
    for (const client of Object.values(seed)) {
      denied(await client.from('audit_logs').update({ action: 'marked_left' }).eq('id', row.id).select());
      denied(await client.from('audit_logs').delete().eq('id', row.id).select());
    }
  });
});

describe('SEC21 - SEC24 operations (database part)', () => {
  const checkinBy = (client: SupabaseClient, tablet: string) =>
    client.rpc('checkin', { p_tablet_id: tablet, p_first_name: 'A', p_surname: 'B', p_date_of_birth: '1990-01-01', p_id_number: null, p_cellphone: null, p_has_file: false, p_assisted: false, p_reason_category: 'Test or screening', p_urgent: false, p_consent_given: true });
  it('T-SEC-21a the Check-in account checks in through the service role', async () => {
    expect((await checkin(own.tablet.id)).error).toBeNull();
  });
  it('T-SEC-21b no app role can run checkin; a non Check-in account cannot check in', async () => {
    for (const account of [own.tablet, own.reception, own.clinical, own.manager]) {
      expect((await checkinBy(account.client, own.tablet.id)).error).not.toBeNull();
    }
    expect((await checkin(own.reception.id)).error).not.toBeNull();
    expect((await checkin(own.manager.id)).error).not.toBeNull();
  });
  it('T-SEC-22a the Manager reads the daily summary', async () => {
    const r = await own.manager.client.rpc('daily_summary');
    expect(r.error).toBeNull();
  });
  it('T-SEC-22b Reception, Clinical and Check-in cannot', async () => {
    for (const account of [own.reception, own.clinical, own.tablet]) {
      expect((await account.client.rpc('daily_summary')).error).not.toBeNull();
    }
  });
  it('T-SEC-23a Clinical calls the next patient', async () => {
    const patient = await mustInsertPatient(own.facilityId);
    await mustInsertVisit(own.facilityId, patient.id, 45, { urgent: true });
    expect((await own.clinical.client.rpc('call_next_patient')).error).toBeNull();
  });
  it('T-SEC-23b Reception, Manager and Check-in cannot call the next patient', async () => {
    for (const account of [own.reception, own.manager, own.tablet]) {
      expect((await account.client.rpc('call_next_patient')).error).not.toBeNull();
    }
  });
  it('T-SEC-24a Reception and Clinical run close_stale_visits and mark_visit_left', async () => {
    expect((await own.reception.client.rpc('close_stale_visits')).error).toBeNull();
    expect((await own.clinical.client.rpc('close_stale_visits')).error).toBeNull();
  });
  it('T-SEC-24b Manager and Check-in cannot', async () => {
    for (const account of [own.manager, own.tablet]) {
      expect((await account.client.rpc('close_stale_visits')).error).not.toBeNull();
    }
  });
});

describe('SEC25 / SEC26 Facility and active', () => {
  it('T-SEC-25a each user reaches the rows of their own Facility', async () => {
    const patient = await mustInsertPatient(other.facilityId);
    allowed(await other.reception.client.from('patients').select('id').eq('id', patient.id));
  });
  it('T-SEC-25b no user reaches the rows of another Facility, by reading or by writing', async () => {
    const patient = await mustInsertPatient(other.facilityId);
    denied(await own.reception.client.from('patients').select('id').eq('id', patient.id));
    denied(await own.reception.client.from('patients').update({ allergies: 'x' }).eq('id', patient.id).select());
    const visit = await mustInsertVisit(other.facilityId, patient.id, 7);
    denied(await own.clinical.client.from('visits').select('id').eq('id', visit.id));
    expect((await own.clinical.client.rpc('mark_visit_left', { p_visit_id: visit.id })).error).not.toBeNull();
  });
  it('T-SEC-26a an active account uses the app', async () => {
    const clinic = await createClinic();
    await mustInsertPatient(clinic.facilityId);
    allowed(await clinic.reception.client.from('patients').select('id'));
  });
  it('T-SEC-26b a disabled account can no longer read or write anything', async () => {
    const clinic = await createClinic();
    const patient = await mustInsertPatient(clinic.facilityId);
    await mustInsertVisit(clinic.facilityId, (await mustInsertPatient(clinic.facilityId)).id, 1);
    await admin.from('staff_profiles').update({ active: false }).in('id', [clinic.reception.id, clinic.clinical.id, clinic.manager.id, clinic.tablet.id]);
    denied(await clinic.reception.client.from('patients').select('id'));
    denied(await clinic.reception.client.from('patients').update({ allergies: 'x' }).eq('id', patient.id).select());
    denied(await clinic.clinical.client.from('visits').select('id'));
    expect((await clinic.clinical.client.rpc('call_next_patient')).error).not.toBeNull();
    expect((await clinic.manager.client.rpc('daily_summary')).error).not.toBeNull();
    expect((await checkin(clinic.tablet.id)).error).not.toBeNull();
    denied(await clinic.manager.client.from('facilities').select('name'));
  });
});
