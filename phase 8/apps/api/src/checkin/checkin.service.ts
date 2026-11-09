import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { CHECKIN_MESSAGES, REASON_CATEGORIES, isValidSaId, normaliseCellphone, sastIsoDate, validateDateOfBirth, validateName } from '@pholo/types';
import { MESSAGES, type AuthUser } from '../auth/auth.types';
import { SupabaseService } from '../auth/supabase.service';

/** The only fields OP4 gives back (BR4, BR10): never a name, a reason or anything else stored about the Patient. */
export interface CheckinResponse {
  queue_number: number;
  already_checked_in: boolean;
  urgent: boolean;
  has_file: boolean;
}

const refuse = (message: string, field: string): never => {
  throw new BadRequestException({ message, field });
};

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

@Injectable()
export class CheckinService {
  constructor(private readonly supabase: SupabaseService) {}

  /** OP4: checks every answer, then lets the database function do the Check-in (BR1, BR3, BR4, BR14, BR16, BR17). */
  async checkIn(user: AuthUser, body: unknown): Promise<CheckinResponse> {
    const input = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;

    const firstName = text(input.first_name);
    if (!validateName(firstName)) refuse(CHECKIN_MESSAGES.firstName, 'first_name');
    const surname = text(input.surname);
    if (!validateName(surname)) refuse(CHECKIN_MESSAGES.surname, 'surname');
    const dateOfBirth = text(input.date_of_birth);
    if (!validateDateOfBirth(dateOfBirth, sastIsoDate(new Date()))) refuse(CHECKIN_MESSAGES.dateOfBirth, 'date_of_birth');
    const idNumber = text(input.id_number);
    if (!isValidSaId(idNumber, dateOfBirth)) refuse(CHECKIN_MESSAGES.idNumber, 'id_number');
    const rawCellphone = text(input.cellphone);
    const cellphone = rawCellphone === '' ? null : normaliseCellphone(rawCellphone);
    if (rawCellphone !== '' && cellphone === null) refuse(CHECKIN_MESSAGES.cellphone, 'cellphone');
    if (typeof input.has_file !== 'boolean') refuse(CHECKIN_MESSAGES.chooseYesNo, 'has_file');
    const reason = input.reason_category;
    if (typeof reason !== 'string' || !(REASON_CATEGORIES as readonly string[]).includes(reason)) {
      refuse(CHECKIN_MESSAGES.reason, 'reason_category');
    }
    if (typeof input.urgent !== 'boolean') refuse(CHECKIN_MESSAGES.chooseYesNo, 'urgent');
    if (input.consent_given !== true) refuse(CHECKIN_MESSAGES.consent, 'consent_given');

    const { data, error } = await this.supabase.admin().rpc('checkin', {
      p_tablet_id: user.id,
      p_first_name: firstName,
      p_surname: surname,
      p_date_of_birth: dateOfBirth,
      p_id_number: idNumber === '' ? null : idNumber,
      p_cellphone: cellphone,
      p_has_file: input.has_file,
      p_assisted: input.assisted === true,
      p_reason_category: reason,
      p_urgent: input.urgent,
      p_consent_given: true,
    });

    if (error) throw this.mapDatabaseError(error);
    const result = (data ?? {}) as Partial<CheckinResponse>;
    return {
      queue_number: Number(result.queue_number),
      already_checked_in: result.already_checked_in === true,
      urgent: result.urgent === true,
      has_file: result.has_file === true,
    };
  }

  private mapDatabaseError(error: { code?: string; message: string }): HttpException {
    if (error.code === '54000') return new HttpException({ message: CHECKIN_MESSAGES.tooMany }, 429);
    if (error.code === '42501') return new HttpException({ message: MESSAGES.notAllowed }, 403);
    return new HttpException({ message: MESSAGES.serverProblem }, 500);
  }
}
