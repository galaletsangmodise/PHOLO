import { HttpException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import type { SupabaseService } from '../auth/supabase.service';
import { CheckinService } from './checkin.service';

const TABLET: AuthUser = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'Check-in',
  fullName: 'Ubuntu Clinic Tablet 1',
  facilityId: '00000000-0000-4000-8000-000000000001',
  facilityName: 'Ubuntu Community Clinic',
  token: 'token',
};

const VALID = {
  first_name: 'Thandi',
  surname: 'Dlamini',
  date_of_birth: '1997-08-14',
  id_number: '9708140234088',
  cellphone: '082 555 0147',
  has_file: false,
  assisted: false,
  reason_category: 'Test or screening',
  urgent: false,
  consent_given: true,
};

function build(rpcResult: { data?: unknown; error?: { code?: string; message: string } | null }) {
  const rpc = jest.fn(async () => ({ data: rpcResult.data ?? null, error: rpcResult.error ?? null }));
  const supabase = { admin: () => ({ rpc }) } as unknown as SupabaseService;
  return { service: new CheckinService(supabase), rpc };
}

async function refusal(promise: Promise<unknown>): Promise<{ status: number; message: string }> {
  try {
    await promise;
  } catch (error) {
    const exception = error as HttpException;
    const body = exception.getResponse() as { message: string };
    return { status: exception.getStatus(), message: body.message };
  }
  throw new Error('Expected a refusal.');
}

describe('OP4 Check-in service', () => {
  it('T-INT-2 calls the database function with the tablet account and the cleaned-up answers', async () => {
    const { service, rpc } = build({ data: { queue_number: 14, already_checked_in: false, urgent: false, has_file: false } });
    await service.checkIn(TABLET, VALID);
    expect(rpc).toHaveBeenCalledWith('checkin', {
      p_tablet_id: TABLET.id,
      p_first_name: 'Thandi',
      p_surname: 'Dlamini',
      p_date_of_birth: '1997-08-14',
      p_id_number: '9708140234088',
      p_cellphone: '+27825550147',
      p_has_file: false,
      p_assisted: false,
      p_reason_category: 'Test or screening',
      p_urgent: false,
      p_consent_given: true,
    });
  });

  it('T-INT-12 answers with the four fields only, never anything stored about the Patient (BR4)', async () => {
    const { service } = build({
      data: { queue_number: 14, already_checked_in: false, urgent: true, has_file: true, first_name: 'Thandi', patient_id: 'x' },
    });
    expect(await service.checkIn(TABLET, VALID)).toEqual({ queue_number: 14, already_checked_in: false, urgent: true, has_file: true });
  });

  it('accepts an empty ID number and cellphone and sends null', async () => {
    const { service, rpc } = build({ data: { queue_number: 1, already_checked_in: false, urgent: false, has_file: false } });
    await service.checkIn(TABLET, { ...VALID, id_number: '', cellphone: null });
    expect(rpc).toHaveBeenCalledWith('checkin', expect.objectContaining({ p_id_number: null, p_cellphone: null }));
  });

  it.each([
    ['first_name', '', 'Please enter your first name.'],
    ['first_name', 'Tha1ndi', 'Please enter your first name.'],
    ['surname', 'a'.repeat(41), 'Please enter your surname.'],
    ['date_of_birth', '1997-02-30', 'Please enter a real date of birth, for example 14 / 08 / 1997.'],
    ['date_of_birth', '1899-12-31', 'Please enter a real date of birth, for example 14 / 08 / 1997.'],
    ['date_of_birth', '2999-01-01', 'Please enter a real date of birth, for example 14 / 08 / 1997.'],
    ['id_number', '9708140234089', 'This ID number does not look right. Check it, or leave it empty if you do not have one.'],
    ['cellphone', '08255501', 'Enter a South African cellphone number, for example 082 555 0147, or leave it empty.'],
    ['has_file', undefined, 'Please choose Yes or No.'],
    ['reason_category', 'Dancing', 'Please choose why you are here today.'],
    ['urgent', 'maybe', 'Please choose Yes or No.'],
    ['consent_given', false, 'Please tick the box to agree to the Privacy Notice to check in.'],
  ])('T-INT-11 invalid %s (%p) is refused with its exact message and nothing is saved', async (field, value, message) => {
    const { service, rpc } = build({ data: {} });
    const result = await refusal(service.checkIn(TABLET, { ...VALID, [field]: value }));
    expect(result).toEqual({ status: 400, message });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('refuses a body that is not an object', async () => {
    const { service, rpc } = build({ data: {} });
    expect((await refusal(service.checkIn(TABLET, undefined))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('T-INT-12 the BR14 limit (database error 54000) answers 429 with the exact message', async () => {
    const { service } = build({ error: { code: '54000', message: 'Too many Check-ins at once. Please wait one minute and try again.' } });
    expect(await refusal(service.checkIn(TABLET, VALID))).toEqual({
      status: 429,
      message: 'Too many Check-ins at once. Please wait one minute and try again.',
    });
  });

  it('a tablet the database does not allow is answered with the not-allowed message', async () => {
    const { service } = build({ error: { code: '42501', message: 'This tablet is not allowed to check patients in.' } });
    expect(await refusal(service.checkIn(TABLET, VALID))).toEqual({ status: 403, message: 'You are not allowed to open this page.' });
  });

  it('any other database error answers with the server problem message and no details', async () => {
    const { service } = build({ error: { code: 'XX000', message: 'relation "patients" secret detail' } });
    expect(await refusal(service.checkIn(TABLET, VALID))).toEqual({ status: 500, message: 'Something went wrong on our side. Please try again.' });
  });
});
