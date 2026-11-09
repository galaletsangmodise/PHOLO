import { admin, buildSaId, createFacility, insertPatient } from './helpers';

let facility: string;
beforeAll(async () => { facility = await createFacility(); });

const idCheck = async (id: string | null, dob: string) => (await admin.rpc('is_valid_sa_id', { p_id: id, p_dob: dob })).data as boolean;
const accepted = async (id: string | null, dob: string) => (await insertPatient(facility, { date_of_birth: dob, id_number: id })).error === null;

describe('BR5 ID number', () => {
  it('T-BR5-1 accepts 9708140234088 with 14 Aug 1997', async () => {
    expect(await idCheck('9708140234088', '1997-08-14')).toBe(true);
    expect(await accepted('9708140234088', '1997-08-14')).toBe(true);
  });
  it('T-BR5-2 refuses 12 or 14 digits and letters', async () => {
    for (const id of ['970814023408', '97081402340881', '970814023408A']) {
      expect(await idCheck(id, '1997-08-14')).toBe(false);
      expect(await accepted(id, '1997-08-14')).toBe(false);
    }
  });
  it('T-BR5-3 refuses when the first 6 digits are not YYMMDD of the date of birth', async () => {
    expect(await idCheck('9708140234088', '1997-08-15')).toBe(false);
    expect(await accepted('9708140234088', '1997-08-15')).toBe(false);
  });
  it('T-BR5-4 refuses a failing last digit', async () => {
    expect(await idCheck('9708140234089', '1997-08-14')).toBe(false);
    expect(await accepted('9708140234089', '1997-08-14')).toBe(false);
  });
  it('T-BR5-5 accepts an empty ID number', async () => {
    expect(await accepted(null, '1997-08-14')).toBe(true);
  });
  it('T-BR5-6 accepts the made-up IDs of PRD 8.4', async () => {
    for (const [id, dob] of [['5405035121082', '1954-05-03'], ['8511225876083', '1985-11-22'], ['9708140234088', '1997-08-14']]) {
      expect(await idCheck(id, dob)).toBe(true);
      expect(id).toBe(buildSaId(dob, id.slice(6, 10)));
    }
  });
});

describe('BR6 cellphone', () => {
  const stored = async (cellphone: string | null) => {
    const { data, error } = await insertPatient(facility, { cellphone });
    return { error, cellphone: (data as { cellphone: string | null } | null)?.cellphone };
  };
  it('T-BR6-1 accepts "082 555 0147", "0825550147" and "+27825550147"', async () => {
    for (const number of ['082 555 0147', '0825550147', '+27825550147']) expect((await stored(number)).error).toBeNull();
  });
  it('T-BR6-2 stores "082 555 0147" as "+27825550147"', async () => {
    expect((await stored('082 555 0147')).cellphone).toBe('+27825550147');
    expect((await admin.rpc('normalise_cellphone', { p_raw: '082 555 0147' })).data).toBe('+27825550147');
  });
  it('T-BR6-3 refuses 8 or 10 digits, letters, or another country code', async () => {
    for (const number of ['08255501', '082555014700', '082555abcd', '+44 7911 123456']) expect((await stored(number)).error).not.toBeNull();
  });
  it('T-BR6-4 accepts an empty cellphone', async () => {
    const r = await stored(null);
    expect(r.error).toBeNull();
    expect(r.cellphone).toBeNull();
  });
});
