import {
  CHECKIN_MESSAGES,
  ageInYears,
  isValidCellphone,
  isValidSaId,
  normaliseCellphone,
  validateDateOfBirth,
  validateName,
} from '@pholo/types';
import type { CheckinAnswers } from './CheckinProvider';

export type DetailsErrors = Partial<Record<'firstName' | 'surname' | 'dateOfBirth' | 'idNumber' | 'cellphone' | 'hasFile', string>>;
export type VisitErrors = Partial<Record<'reason' | 'urgent' | 'consent', string>>;

/** The three date boxes as "YYYY-MM-DD", or null when they do not hold digits in the right places. */
export function dateOfBirthIso(answers: Pick<CheckinAnswers, 'day' | 'month' | 'year'>): string | null {
  const { day, month, year } = answers;
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Whole years on the given day ("YYYY-MM-DD"). The rule lives in the shared package (also used by S7 and S8). */
export const ageOn = ageInYears;

export function validateDetails(answers: CheckinAnswers, today: string): DetailsErrors {
  const errors: DetailsErrors = {};
  if (!validateName(answers.firstName.trim())) errors.firstName = CHECKIN_MESSAGES.firstName;
  if (!validateName(answers.surname.trim())) errors.surname = CHECKIN_MESSAGES.surname;
  const dateOfBirth = dateOfBirthIso(answers);
  if (!dateOfBirth || !validateDateOfBirth(dateOfBirth, today)) {
    errors.dateOfBirth = CHECKIN_MESSAGES.dateOfBirth;
  } else if (!isValidSaId(answers.idNumber.trim(), dateOfBirth)) {
    errors.idNumber = CHECKIN_MESSAGES.idNumber;
  }
  if (!isValidCellphone(answers.cellphone)) errors.cellphone = CHECKIN_MESSAGES.cellphone;
  if (answers.hasFile === null) errors.hasFile = CHECKIN_MESSAGES.chooseYesNo;
  return errors;
}

export function validateVisit(answers: CheckinAnswers): VisitErrors {
  const errors: VisitErrors = {};
  if (answers.reason === null) errors.reason = CHECKIN_MESSAGES.reason;
  if (answers.urgent === null) errors.urgent = CHECKIN_MESSAGES.chooseYesNo;
  if (!answers.consent) errors.consent = CHECKIN_MESSAGES.consent;
  return errors;
}

/** The body of OP4. Empty optional answers go as null; the cellphone number goes as +27 and 9 digits (BR6). */
export function checkinBody(answers: CheckinAnswers) {
  const idNumber = answers.idNumber.trim();
  return {
    first_name: answers.firstName.trim(),
    surname: answers.surname.trim(),
    date_of_birth: dateOfBirthIso(answers),
    id_number: idNumber === '' ? null : idNumber,
    cellphone: answers.cellphone.trim() === '' ? null : normaliseCellphone(answers.cellphone),
    has_file: answers.hasFile,
    assisted: answers.assisted,
    reason_category: answers.reason,
    urgent: answers.urgent,
    consent_given: answers.consent,
  };
}
