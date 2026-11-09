import { admin, createClinic, mustInsertPatient, TestClinic } from './helpers';

let clinic: TestClinic;
beforeAll(async () => { clinic = await createClinic(); });
const digitise = (client: TestClinic['reception']['client'], id: string, values: Record<string, unknown> = {}) =>
  client.from('patients').update({ paper_file_status: 'Paper file - digitised', ...values }).eq('id', id).select();

describe('BR18 paper file status', () => {
  it('T-BR18-1 all three history fields empty: "Paper file - digitised" is refused', async () => {
    const patient = await mustInsertPatient(clinic.facilityId, { paper_file_status: 'Paper file - not yet digitised' });
    expect((await digitise(clinic.reception.client, patient.id)).error).not.toBeNull();
    expect((await digitise(clinic.reception.client, patient.id, { allergies: '   ' })).error).not.toBeNull();
    expect((await admin.from('patients').select('paper_file_status').eq('id', patient.id).single()).data?.paper_file_status).toBe('Paper file - not yet digitised');
  });
  it('T-BR18-2 from "No paper file" it is refused; from "not yet digitised" with one field filled it is accepted', async () => {
    const none = await mustInsertPatient(clinic.facilityId, { paper_file_status: 'No paper file' });
    expect((await digitise(clinic.reception.client, none.id, { allergies: 'Penicillin' })).error).not.toBeNull();
    const pending = await mustInsertPatient(clinic.facilityId, { paper_file_status: 'Paper file - not yet digitised' });
    const r = await digitise(clinic.reception.client, pending.id, { current_medication: 'Amlodipine 5 mg once a day' });
    expect(r.error).toBeNull();
    expect(r.data?.[0].paper_file_status).toBe('Paper file - digitised');
  });
  it('T-BR18-3 Reception and Clinical can both do it with a field filled', async () => {
    for (const account of [clinic.reception, clinic.clinical]) {
      const patient = await mustInsertPatient(clinic.facilityId, { paper_file_status: 'Paper file - not yet digitised' });
      expect((await digitise(account.client, patient.id, { chronic_conditions: 'Hypertension' })).error).toBeNull();
    }
  });
  it('T-BR18-4 the file number cannot be changed', async () => {
    const patient = await mustInsertPatient(clinic.facilityId);
    expect((await admin.from('patients').update({ file_number: 'PH-000500' }).eq('id', patient.id)).error).not.toBeNull();
    expect((await clinic.reception.client.from('patients').update({ file_number: 'PH-000500' }).eq('id', patient.id)).error).not.toBeNull();
  });
});
