import { OUTCOMES, type Outcome, type PaperFileStatus, type ReasonCategory, type VisitStatus } from './domain';
import { validateIcd10Codes } from './rules';

export const SYMPTOMS_MAX = 1000;
export const NOTES_MAX = 2000;

export const VISIT_MESSAGES = {
  symptomsRequired: "Please write the patient's symptoms before completing the visit.",
  symptomsTooLong: 'Symptoms can be at most 1000 characters.',
  notesTooLong: 'Notes can be at most 2000 characters.',
  icd10Invalid: 'Use codes like J06.9, separated by commas. Maximum 5 codes.',
  outcomeRequired: 'Please choose an outcome.',
  visitNotFound: 'We could not find this visit.',
  /** BR9: a finished Visit (and a Visit not In consultation) cannot be saved or completed. */
  notEditable: 'This visit can no longer be changed.',
  /** OP7 on a Visit that is not Called. */
  cannotStart: 'This visit cannot be started.',
} as const;

export type VisitField = 'symptoms' | 'notes' | 'icd10_codes' | 'outcome';
export const VISIT_FIELD_ORDER: readonly VisitField[] = ['symptoms', 'notes', 'icd10_codes', 'outcome'];

/** What S9 holds. An empty text is "nothing typed"; an empty outcome is "Choose an outcome". */
export interface VisitFormValues {
  symptoms: string;
  notes: string;
  icd10_codes: string;
  outcome: string;
}
export type VisitFormErrors = Partial<Record<VisitField, string>>;

const isOutcome = (value: string): value is Outcome => (OUTCOMES as readonly string[]).includes(value);

/** The limits that hold for a draft as well as for a completed Visit. */
function limitErrors(values: VisitFormValues): VisitFormErrors {
  const errors: VisitFormErrors = {};
  if (values.symptoms.trim().length > SYMPTOMS_MAX) errors.symptoms = VISIT_MESSAGES.symptomsTooLong;
  if (values.notes.length > NOTES_MAX) errors.notes = VISIT_MESSAGES.notesTooLong;
  if (!validateIcd10Codes(values.icd10_codes)) errors.icd10_codes = VISIT_MESSAGES.icd10Invalid;
  if (values.outcome !== '' && !isOutcome(values.outcome)) errors.outcome = VISIT_MESSAGES.outcomeRequired;
  return errors;
}

/** "Save draft" (OP15): no field is required, only the limits apply. */
export function draftErrors(values: VisitFormValues): VisitFormErrors {
  return limitErrors(values);
}

/** "Complete visit" (OP16, BR8): symptoms and an outcome are required. */
export function visitFormErrors(values: VisitFormValues): VisitFormErrors {
  const errors = limitErrors(values);
  if (values.symptoms.trim() === '') errors.symptoms = VISIT_MESSAGES.symptomsRequired;
  if (!isOutcome(values.outcome)) errors.outcome = VISIT_MESSAGES.outcomeRequired;
  return errors;
}

/** OP14: the Visit with its saved draft, and the Patient strip with the paper file history (S9). */
export interface VisitDetailResponse {
  visit: {
    id: string;
    patient_id: string;
    queue_number: number;
    checkin_at: string;
    reason_category: ReasonCategory;
    urgent: boolean;
    status: VisitStatus;
    symptoms: string | null;
    notes: string | null;
    icd10_codes: string | null;
    outcome: Outcome | null;
  };
  patient: {
    id: string;
    file_number: string;
    first_name: string;
    surname: string;
    date_of_birth: string;
    paper_file_status: PaperFileStatus;
    chronic_conditions: string | null;
    allergies: string | null;
    current_medication: string | null;
  };
}
