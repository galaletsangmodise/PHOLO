import { admin, checkin, createClinic, mustInsertPatient, mustInsertVisit, TestClinic } from './helpers';

let clinic: TestClinic;
beforeAll(async () => { clinic = await createClinic(); });

type Row = { actor_id: string; action: string; entity_type: string; entity_id: string; created_at: string };
const rowsFor = async (entityId: string, action: string): Promise<Row[]> =>
  (await admin.from('audit_logs').select('actor_id, action, entity_type, entity_id, created_at').eq('entity_id', entityId).eq('action', action)).data as Row[];

describe('BR16 AuditLog', () => {
  const direct: [string, 'Patient' | 'Visit'][] = [
    ['opened_patient_file', 'Patient'], ['created_patient', 'Patient'], ['updated_patient', 'Patient'],
    ['recorded_paper_history', 'Patient'], ['started_consultation', 'Visit'], ['saved_draft', 'Visit'], ['completed_visit', 'Visit'],
  ];
  it.each(direct)('T-BR16 write_audit for %s writes one row with actor, action, entity type, entity id and time', async (action, entityType) => {
    const patient = await mustInsertPatient(clinic.facilityId);
    const entityId = entityType === 'Patient' ? patient.id : (await mustInsertVisit(clinic.facilityId, patient.id, Math.floor(Math.random() * 1e6) + 1)).id;
    const r = await admin.rpc('write_audit', { p_facility_id: clinic.facilityId, p_actor_id: clinic.reception.id, p_action: action, p_entity_type: entityType, p_entity_id: entityId });
    expect(r.error).toBeNull();
    const rows = await rowsFor(entityId, action);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: clinic.reception.id, action, entity_type: entityType, entity_id: entityId });
    expect(Math.abs(Date.now() - new Date(rows[0].created_at).getTime())).toBeLessThan(60_000);
  });

  it('T-BR16 checkin writes checked_in with the tablet as actor', async () => {
    await checkin(clinic.tablet.id, { p_first_name: 'Audit', p_surname: 'Tester' });
    const visit = (await admin.from('visits').select('id').eq('facility_id', clinic.facilityId).order('created_at', { ascending: false }).limit(1).single()).data!;
    const rows = await rowsFor(visit.id, 'checked_in');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: clinic.tablet.id, entity_type: 'Visit' });
  });

  it('T-BR16 call_next_patient writes called_next and mark_visit_left writes marked_left', async () => {
    const [a, b] = await Promise.all([mustInsertPatient(clinic.facilityId, { first_name: 'Aud' }), mustInsertPatient(clinic.facilityId, { first_name: 'Bud' })]);
    const first = await mustInsertVisit(clinic.facilityId, a.id, 901);
    const called = await clinic.clinical.client.rpc('call_next_patient');
    const calledId = called.data.visit_id;
    expect((await rowsFor(calledId, 'called_next'))[0]).toMatchObject({ actor_id: clinic.clinical.id });
    const second = await mustInsertVisit(clinic.facilityId, b.id, 902);
    await clinic.reception.client.rpc('mark_visit_left', { p_visit_id: second.id });
    expect((await rowsFor(second.id, 'marked_left'))[0]).toMatchObject({ actor_id: clinic.reception.id, entity_type: 'Visit' });
    expect(first.id).toBeDefined();
  });

  it('T-BR16-11 a row cannot be updated or deleted', async () => {
    const row = (await admin.from('audit_logs').select('id').eq('facility_id', clinic.facilityId).limit(1).single()).data!;
    expect((await admin.from('audit_logs').update({ action: 'marked_left' }).eq('id', row.id)).error).not.toBeNull();
    expect((await admin.from('audit_logs').delete().eq('id', row.id)).error).not.toBeNull();
    for (const account of [clinic.reception, clinic.clinical, clinic.manager, clinic.tablet]) {
      await account.client.from('audit_logs').update({ action: 'marked_left' }).eq('id', row.id);
      await account.client.from('audit_logs').delete().eq('id', row.id);
    }
    expect((await admin.from('audit_logs').select('action').eq('id', row.id).single()).data?.action).not.toBe('marked_left');
  });

  it('T-BR16-12 admin_correct_visit writes one corrected_visit row with the Manager as actor', async () => {
    const patient = await mustInsertPatient(clinic.facilityId);
    const visit = await mustInsertVisit(clinic.facilityId, patient.id, 903, { status: 'Completed', symptoms: 'x', outcome: 'Other' });
    await admin.rpc('admin_correct_visit', { p_visit_id: visit.id, p_manager_id: clinic.manager.id, p_field: 'notes', p_value: 'Fixed' });
    const rows = await rowsFor(visit.id, 'corrected_visit');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: clinic.manager.id, entity_type: 'Visit', entity_id: visit.id });
  });
});
