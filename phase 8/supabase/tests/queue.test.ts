import { admin, createClinic, createStaff, minutesAgo, mustInsertPatient, mustInsertVisit, TestClinic } from './helpers';

let clinic: TestClinic;
const waiting = async (queue: number, patient: string, extra: Record<string, unknown> = {}) =>
  mustInsertVisit(clinic.facilityId, patient, queue, extra);

beforeEach(async () => { clinic = await createClinic(); });

describe('BR2 call next', () => {
  it('T-BR2-1 chooses urgent first, then the earliest Check-in', async () => {
    const [a, b, c, d] = await Promise.all([1, 2, 3, 4].map((i) => mustInsertPatient(clinic.facilityId, { first_name: `Name${'x'.repeat(i)}` })));
    await waiting(1, a.id, { checkin_at: minutesAgo(40) });
    const urgentLate = await waiting(2, b.id, { checkin_at: minutesAgo(10), urgent: true });
    const urgentEarly = await waiting(3, c.id, { checkin_at: minutesAgo(20), urgent: true });
    await waiting(4, d.id, { checkin_at: minutesAgo(30) });

    const first = await clinic.clinical.client.rpc('call_next_patient');
    expect(first.error).toBeNull();
    expect(first.data.visit_id).toBe(urgentEarly.id);
    const second = await clinic.clinical.client.rpc('call_next_patient');
    expect(second.data.visit_id).toBe(urgentLate.id);
    const third = await clinic.clinical.client.rpc('call_next_patient');
    expect(third.data.queue_number).toBe(1);
  });

  it('T-BR2-2 two Clinical users calling at the same moment get different Visits', async () => {
    const second = await createStaff(clinic.facilityId, 'Clinical');
    const [a, b] = await Promise.all([mustInsertPatient(clinic.facilityId, { first_name: 'Aaa' }), mustInsertPatient(clinic.facilityId, { first_name: 'Bbb' })]);
    await waiting(1, a.id, { checkin_at: minutesAgo(20) });
    await waiting(2, b.id, { checkin_at: minutesAgo(10) });
    const [r1, r2] = await Promise.all([clinic.clinical.client.rpc('call_next_patient'), second.client.rpc('call_next_patient')]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(r1.data.visit_id).toBeDefined();
    expect(r2.data.visit_id).toBeDefined();
    expect(r1.data.visit_id).not.toBe(r2.data.visit_id);
  });

  it('T-BR2-3 with no Waiting Visit nothing changes and "none waiting" is returned', async () => {
    const patient = await mustInsertPatient(clinic.facilityId);
    const visit = await waiting(1, patient.id, { status: 'In consultation' });
    const r = await clinic.clinical.client.rpc('call_next_patient');
    expect(r.error).toBeNull();
    expect(r.data).toEqual({ none_waiting: true });
    expect((await admin.from('visits').select('status').eq('id', visit.id).single()).data?.status).toBe('In consultation');
  });

  it('records who called and when (called_by, called_at)', async () => {
    const patient = await mustInsertPatient(clinic.facilityId);
    const visit = await waiting(1, patient.id);
    await clinic.clinical.client.rpc('call_next_patient');
    const row = (await admin.from('visits').select('status, called_by, called_at').eq('id', visit.id).single()).data;
    expect(row).toMatchObject({ status: 'Called', called_by: clinic.clinical.id });
    expect(row?.called_at).not.toBeNull();
  });
});
