import type { Outcome, PaperFileStatus, ReasonCategory, VisitStatus } from './domain';
import { isValidCellphone, isValidSaId, validateDateOfBirth, validateName } from './rules';

/** The exact messages of S7, S8 and M2 (PRD 8.2 and 12.2). The web app and OP9 to OP12 use the same words. */
export const PATIENT_MESSAGES = {
  searchTooShort: 'Type at least 2 characters to search.',
  searchFailed: 'Search did not work. Please try again.',
  fileNotOpened: 'We could not open this file. Please try again.',
  firstName: 'Please enter the first name.',
  surname: 'Please enter the surname.',
  dateOfBirth: 'Please enter a real date of birth, for example 14 / 08 / 1997.',
  idNumber: 'This ID number does not look right. Check it, or leave it empty if the patient does not have one.',
  idNumberExists: 'A patient with this ID number already exists. Open their file instead.',
  cellphone: 'Enter a South African cellphone number, for example 083 555 0198, or leave it empty.',
  paperFileStatus: 'Please choose a paper file status.',
} as const;

/** What M2 offers when a Patient File is created. "Paper file - digitised" is only reached through M3 (BR18). */
export const NEW_PATIENT_PAPER_FILE_STATUSES = ['No paper file', 'Paper file - not yet digitised'] as const satisfies readonly PaperFileStatus[];
export const DEFAULT_PAPER_FILE_STATUS: PaperFileStatus = 'No paper file';

/** BR13: a search needs at least 2 characters, and shows at most 20 results. */
export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_MAX_RESULTS = 20;

/** The five details of M2, written the way the API receives them. */
export interface PatientInput {
  first_name: string;
  surname: string;
  date_of_birth: string;
  id_number: string | null;
  cellphone: string | null;
}
export interface NewPatientInput extends PatientInput {
  paper_file_status: PaperFileStatus;
}

/** OP9: one result of a search. Only the last 4 digits of the ID number leave the server (PRD 12.4). */
export interface PatientSearchItem {
  id: string;
  file_number: string;
  first_name: string;
  surname: string;
  date_of_birth: string;
  id_number_last4: string | null;
  paper_file_status: PaperFileStatus;
}
/** OP10, OP11, OP12: the Patient File's own fields (never a Visit's clinical field). */
export interface PatientRecord {
  id: string;
  file_number: string;
  first_name: string;
  surname: string;
  date_of_birth: string;
  id_number: string | null;
  cellphone: string | null;
  paper_file_status: PaperFileStatus;
  chronic_conditions: string | null;
  allergies: string | null;
  current_medication: string | null;
}
/** A Visit as the Patient File shows it: date, number, reason, status. No symptoms, notes, ICD-10 codes or outcome (SEC11). */
export interface PatientFileVisit {
  id: string;
  queue_number: number;
  checkin_at: string;
  reason_category: ReasonCategory;
  status: VisitStatus;
  urgent: boolean;
}
/** What Clinical also sees on a Visit card after "Show details" (PRD S8, SEC10). Reception never gets these keys. */
export interface PatientFileVisitDetails extends PatientFileVisit {
  symptoms: string | null;
  notes: string | null;
  icd10_codes: string | null;
  outcome: Outcome | null;
  clinician_name: string | null;
}
export interface PatientFileResponse {
  patient: PatientRecord;
  visits: Array<PatientFileVisit | PatientFileVisitDetails>;
}

export type PatientField = 'first_name' | 'surname' | 'date_of_birth' | 'id_number' | 'cellphone' | 'paper_file_status';
export interface PatientFormValues {
  first_name: string;
  surname: string;
  /** "YYYY-MM-DD", or empty when the boxes do not hold a date. */
  date_of_birth: string;
  id_number: string;
  cellphone: string;
  /** Only checked when a Patient File is created. */
  paper_file_status?: string;
}
export type PatientFormErrors = Partial<Record<PatientField, string>>;

/** The order the API reports a fault in (the first one found). */
export const PATIENT_FIELD_ORDER: readonly PatientField[] = ['first_name', 'surname', 'date_of_birth', 'id_number', 'cellphone', 'paper_file_status'];

/** M2 checks (BR5, BR6): used by the form and by OP11 and OP12 so both say the same thing. */
export function patientFormErrors(values: PatientFormValues, today: string, creating: boolean): PatientFormErrors {
  const errors: PatientFormErrors = {};
  if (!validateName(values.first_name.trim())) errors.first_name = PATIENT_MESSAGES.firstName;
  if (!validateName(values.surname.trim())) errors.surname = PATIENT_MESSAGES.surname;
  if (!validateDateOfBirth(values.date_of_birth, today)) {
    errors.date_of_birth = PATIENT_MESSAGES.dateOfBirth;
  } else if (!isValidSaId(values.id_number.trim(), values.date_of_birth)) {
    errors.id_number = PATIENT_MESSAGES.idNumber;
  }
  if (!isValidCellphone(values.cellphone)) errors.cellphone = PATIENT_MESSAGES.cellphone;
  if (creating && !(NEW_PATIENT_PAPER_FILE_STATUSES as readonly string[]).includes(values.paper_file_status ?? '')) {
    errors.paper_file_status = PATIENT_MESSAGES.paperFileStatus;
  }
  return errors;
}


/** The exact words of M3 Paper file history (PRD 8.2 M3, BR18). The web app and OP13 use the same words. */
export const PAPER_HISTORY_MESSAGES = {
  chronicConditions: 'Chronic conditions can be at most 500 characters.',
  allergies: 'Allergies can be at most 300 characters.',
  currentMedication: 'Current medication can be at most 500 characters.',
  markWithoutHistory: 'Add at least one item from the paper file before marking it as digitised.',
  saved: 'Paper file history saved.',
} as const;

/** BR18 and PRD 10.1: the longest each history text may be. */
export const PAPER_HISTORY_LIMITS = { chronic_conditions: 500, allergies: 300, current_medication: 500 } as const;

export type PaperHistoryTextField = keyof typeof PAPER_HISTORY_LIMITS;
export type PaperHistoryField = PaperHistoryTextField | 'mark_digitised';

/** OP13 as the API receives it: an empty text is null. The three texts replace what is stored. */
export interface PaperHistoryInput {
  chronic_conditions: string | null;
  allergies: string | null;
  current_medication: string | null;
  mark_digitised: boolean;
}
/** M3 as typed: the texts are plain strings. */
export interface PaperHistoryFormValues {
  chronic_conditions: string;
  allergies: string;
  current_medication: string;
  mark_digitised: boolean;
}
export type PaperHistoryErrors = Partial<Record<PaperHistoryField, string>>;

/** The order OP13 reports a fault in (the first one found). */
export const PAPER_HISTORY_FIELD_ORDER: readonly PaperHistoryField[] = ['chronic_conditions', 'allergies', 'current_medication', 'mark_digitised'];

const LIMIT_MESSAGES: Record<PaperHistoryTextField, string> = {
  chronic_conditions: PAPER_HISTORY_MESSAGES.chronicConditions,
  allergies: PAPER_HISTORY_MESSAGES.allergies,
  current_medication: PAPER_HISTORY_MESSAGES.currentMedication,
};

/** M3 checks (BR18): used by the form and by OP13 so both say the same thing. Spaces around a text do not count. */
export function paperHistoryErrors(values: PaperHistoryFormValues): PaperHistoryErrors {
  const errors: PaperHistoryErrors = {};
  const texts = Object.keys(PAPER_HISTORY_LIMITS) as PaperHistoryTextField[];
  for (const field of texts) {
    if (values[field].trim().length > PAPER_HISTORY_LIMITS[field]) errors[field] = LIMIT_MESSAGES[field];
  }
  if (values.mark_digitised && texts.every((field) => values[field].trim() === '')) {
    errors.mark_digitised = PAPER_HISTORY_MESSAGES.markWithoutHistory;
  }
  return errors;
}
