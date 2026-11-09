import { admin, createClinic, minutesAgo, mustInsertPatient, mustInsertVisit, TestClinic } from './helpers';

let clinic: TestClinic;
beforeEach(async () => { clinic = await createClinic(); });

const newVisit = async (queue: number, extra: Record<string, unknown> = {}) => {
  const patient = await mustInsertPatient(clinic.facilityId, { first_name: `P${'x'.repeat(queue)}` });
  return mustInsertVisit(clinic.facilityId, patient.id, queue, extra);
};
const statusOf = async (id: string) => (await admin.from('visits').select('status, left_at, completed_at, started_at, clinician').eq('id', id).single()).data!;
const clinicalUpdate = (id: string, values: Record<string, unknown>) => clinic.clinical.client.from('visits').update(values).eq('id', id).select();

describe('BR7 status changes', () => {
  it('T-BR7-1 close_stale_visits sets earlier open Visits to Left with left_at', async () => {
    const old = minutesAgo(3 * 24 * 60);
    const ids = [
      (await newVisit(1, { checkin_at: old, status: 'Waiting' })).id,
      (await newVisit(2, { checkin_at: old, status: 'Called' })).id,
      (await newVisit(3, { checkin_at: old, status: 'In consultation' })).id,
    ];
    const r = await clinic.reception.client.rpc('close_stale_visits');
    expect(r.error).toBeNull();
    for (const id of ids) {
      const row = await statusOf(id);
      expect(row.status).toBe('Left');
      expect(row.left_at).not.toBeNull();
    }
  });
  it('T-BR7-2 today\'s open Visits are untouched', async () => {
    const visit = await newVisit(1);
    await clinic.reception.client.rpc('close_stale_visits');
    expect((await statusOf(visit.id)).status).toBe('Waiting');
  });
  it('T-BR7-3 earlier Completed Visits are untouched', async () => {
    const visit = await newVisit(1, { checkin_at: minutesAgo(3 * 24 * 60), status: 'Completed', symptoms: 'x', outcome: 'Other' });
    await clinic.reception.client.rpc('close_stale_visits');
    expect((await statusOf(visit.id)).status).toBe('Completed');
  });
  it('T-BR7-4 Reception and Clinical mark Waiting or Called as Left; In consultation cannot be marked', async () => {
    const waitingVisit = await newVisit(1);
    const calledVisit = await newVisit(2, { status: 'Called' });
    const consult = await newVisit(3, { status: 'In consultation' });
    expect((await clinic.reception.client.rpc('mark_visit_left', { p_visit_id: waitingVisit.id })).error).toBeNull();
    expect((await clinic.clinical.client.rpc('mark_visit_left', { p_visit_id: calledVisit.id })).error).toBeNull();
    expect((await statusOf(waitingVisit.id)).left_at).not.toBeNull();
    expect((await statusOf(calledVisit.id)).status).toBe('Left');
    expect((await clinic.reception.client.rpc('mark_visit_left', { p_visit_id: consult.id })).error).not.toBeNull();
    expect((await clinicalUpdate(consult.id, { status: 'Left' })).error).not.toBeNull();
  });
  it('T-BR7-5 every other status change is refused', async () => {
    const waitingVisit = await newVisit(1);
    const calledVisit = await newVisit(2, { status: 'Called' });
    const completed = await newVisit(3, { status: 'Completed', symptoms: 'x', outcome: 'Other' });
    const left = await newVisit(4, { status: 'Left' });
    expect((await clinicalUpdate(waitingVisit.id, { status: 'Completed', symptoms: 'x', outcome: 'Other' })).error).not.toBeNull();
    expect((await clinicalUpdate(waitingVisit.id, { status: 'In consultation' })).error).not.toBeNull();
    expect((await clinicalUpdate(calledVisit.id, { status: 'Waiting' })).error).not.toBeNull();
    for (const target of ['Waiting', 'Called', 'In consultation', 'Left']) {
      expect((await clinicalUpdate(completed.id, { status: target })).error).not.toBeNull();
    }
    for (const target of ['Waiting', 'Called', 'In consultation', 'Completed']) {
      expect((await clinicalUpdate(left.id, { status: target })).error).not.toBeNull();
    }
    expect((await clinic.reception.client.from('visits').update({ status: 'Called' }).eq('id', waitingVisit.id).select()).data ?? []).toHaveLength(0);
  });
  it('T-BR7-6 Called to In consultation by Clinical sets started_at and clinician', async () => {
    const visit = await newVisit(1, { status: 'Called' });
    expect((await clinicalUpdate(visit.id, { status: 'In consultation' })).error).toBeNull();
    const row = await statusOf(visit.id);
    expect(row).toMatchObject({ status: 'In consultation', clinician: clinic.clinical.id });
    expect(row.started_at).not.toBeNull();
  });
  it('T-BR7-7 close_stale_visits writes marked_left for the user who opened S6', async () => {
    const visit = await newVisit(1, { checkin_at: minutesAgo(3 * 24 * 60) });
    await clinic.reception.client.rpc('close_stale_visits');
    const { data } = await admin.from('audit_logs').select('actor_id, action, entity_type, entity_id').eq('entity_id', visit.id);
    expect(data).toEqual([{ actor_id: clinic.reception.id, action: 'marked_left', entity_type: 'Visit', entity_id: visit.id }]);
    expect((await statusOf(visit.id)).left_at).not.toBeNull();
  });
});

describe('BR8 completing a Visit', () => {
  const inConsultation = (queue: number) => newVisit(queue, { status: 'In consultation' });
  it('T-BR8-1 completing without symptoms or without an outcome is refused', async () => {
    const visit = await inConsultation(1);
    expect((await clinicalUpdate(visit.id, { status: 'Completed', outcome: 'Other' })).error).not.toBeNull();
    expect((await clinicalUpdate(visit.id, { status: 'Completed', symptoms: 'Cough' })).error).not.toBeNull();
    expect((await clinicalUpdate(visit.id, { status: 'Completed', symptoms: 'a'.repeat(1001), outcome: 'Other' })).error).not.toBeNull();
    expect((await clinicalUpdate(visit.id, { status: 'Completed', symptoms: 'Cough', outcome: 'Other' })).error).toBeNull();
    expect((await statusOf(visit.id)).completed_at).not.toBeNull();
  });
  it('T-BR8-2 accepts "J06.9", "A09" and "J06.9, R50.9"', async () => {
    for (const codes of ['J06.9', 'A09', 'J06.9, R50.9']) {
      const visit = await inConsultation(Math.floor(Math.random() * 1e6) + 1);
      expect((await clinicalUpdate(visit.id, { icd10_codes: codes })).error).toBeNull();
    }
  });
  it('T-BR8-3 refuses "J069x" and "j06.9"', async () => {
    const visit = await inConsultation(1);
    expect((await clinicalUpdate(visit.id, { icd10_codes: 'J069x' })).error).not.toBeNull();
    expect((await clinicalUpdate(visit.id, { icd10_codes: 'j06.9' })).error).not.toBeNull();
  });
  it('T-BR8-4 accepts 5 codes and refuses 6', async () => {
    const visit = await inConsultation(1);
    expect((await clinicalUpdate(visit.id, { icd10_codes: 'A01, A02, A03, A04, A05' })).error).toBeNull();
    expect((await clinicalUpdate(visit.id, { icd10_codes: 'A01, A02, A03, A04, A05, A06' })).error).not.toBeNull();
  });
  it('T-BR8-5 accepts notes of 2000 characters and refuses 2001', async () => {
    const visit = await inConsultation(1);
    expect((await clinicalUpdate(visit.id, { notes: 'a'.repeat(2000) })).error).toBeNull();
    expect((await clinicalUpdate(visit.id, { notes: 'a'.repeat(2001) })).error).not.toBeNull();
  });
  it('T-BR8-6 a draft with every field empty is accepted', async () => {
    const visit = await inConsultation(1);
    const r = await clinicalUpdate(visit.id, { symptoms: null, notes: null, icd10_codes: null, outcome: null });
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(1);
  });
});

describe('BR9 finished Visits', () => {
  const completedVisit = () => newVisit(1, { status: 'Completed', symptoms: 'Cough', outcome: 'Other' });
  it('T-BR9-1 any change to a Completed Visit by an app user is refused', async () => {
    const visit = await completedVisit();
    for (const account of [clinic.clinical, clinic.reception, clinic.manager, clinic.tablet]) {
      await account.client.from('visits').update({ notes: 'Changed' }).eq('id', visit.id);
      await account.client.from('visits').update({ status: 'Waiting' }).eq('id', visit.id);
    }
    const row = (await admin.from('visits').select('notes, status').eq('id', visit.id).single()).data;
    expect(row).toEqual({ notes: null, status: 'Completed' });
    expect((await clinicalUpdate(visit.id, { notes: 'Changed' })).error).not.toBeNull();
  });
  it('T-BR9-2 an app user cannot delete a Visit', async () => {
    const visit = await completedVisit();
    for (const account of [clinic.clinical, clinic.reception, clinic.manager, clinic.tablet]) {
      await account.client.from('visits').delete().eq('id', visit.id);
    }
    expect((await admin.from('visits').select('id').eq('id', visit.id)).data).toHaveLength(1);
  });
  it('T-BR9-4 admin_correct_visit changes the field and logs corrected_visit for the Manager; a direct update still fails', async () => {
    const visit = await completedVisit();
    const r = await admin.rpc('admin_correct_visit', { p_visit_id: visit.id, p_manager_id: clinic.manager.id, p_field: 'notes', p_value: 'Corrected note' });
    expect(r.error).toBeNull();
    expect((await admin.from('visits').select('notes').eq('id', visit.id).single()).data?.notes).toBe('Corrected note');
    const log = (await admin.from('audit_logs').select('actor_id, action, entity_id').eq('action', 'corrected_visit').eq('entity_id', visit.id)).data;
    expect(log).toEqual([{ actor_id: clinic.manager.id, action: 'corrected_visit', entity_id: visit.id }]);
    expect((await admin.from('visits').update({ notes: 'Direct' }).eq('id', visit.id)).error).not.toBeNull();
  });
  it('admin_correct_visit refuses fields outside the four clinical fields and managers of another Facility', async () => {
    const visit = await completedVisit();
    expect((await admin.rpc('admin_correct_visit', { p_visit_id: visit.id, p_manager_id: clinic.manager.id, p_field: 'status', p_value: 'Waiting' })).error).not.toBeNull();
    const other = await createClinic();
    expect((await admin.rpc('admin_correct_visit', { p_visit_id: visit.id, p_manager_id: other.manager.id, p_field: 'notes', p_value: 'x' })).error).not.toBeNull();
  });
});
