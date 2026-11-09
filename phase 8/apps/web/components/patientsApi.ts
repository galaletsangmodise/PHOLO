import type { NewPatientInput, Outcome, PatientFileResponse, PatientFileVisit, PatientFileVisitDetails, PatientInput, PatientRecord as ApiPatientRecord, PatientSearchItem, PaperFileStatus, ReasonCategory, VisitStatus } from '@pholo/types';
import { getAccessToken } from './accessToken';
import { apiRequest } from './api';

export interface PatientSummary {
  id: string;
  fileNumber: string;
  firstName: string;
  surname: string;
  dateOfBirth: string;
  idNumberLast4: string | null;
  paperFileStatus: PaperFileStatus;
}
export interface PatientRecord {
  id: string;
  fileNumber: string;
  firstName: string;
  surname: string;
  dateOfBirth: string;
  idNumber: string | null;
  cellphone: string | null;
  paperFileStatus: PaperFileStatus;
  chronicConditions: string | null;
  allergies: string | null;
  currentMedication: string | null;
}
export interface PatientVisit {
  id: string;
  queueNumber: number;
  checkinAt: string;
  reasonCategory: ReasonCategory;
  status: VisitStatus;
  urgent: boolean;
  /** Only Clinical gets these (SEC10): shown by "Show details" on S8. */
  details?: VisitDetails;
}
export interface VisitDetails {
  symptoms: string | null;
  notes: string | null;
  icd10Codes: string | null;
  outcome: Outcome | null;
  clinicianName: string | null;
}

const toSummary = (p: PatientSearchItem): PatientSummary => ({
  id: p.id, fileNumber: p.file_number, firstName: p.first_name, surname: p.surname, dateOfBirth: p.date_of_birth,
  idNumberLast4: p.id_number_last4, paperFileStatus: p.paper_file_status,
});
const toRecord = (p: ApiPatientRecord): PatientRecord => ({
  id: p.id, fileNumber: p.file_number, firstName: p.first_name, surname: p.surname, dateOfBirth: p.date_of_birth,
  idNumber: p.id_number, cellphone: p.cellphone, paperFileStatus: p.paper_file_status,
  chronicConditions: p.chronic_conditions, allergies: p.allergies, currentMedication: p.current_medication,
});
const toVisit = (v: PatientFileVisit | PatientFileVisitDetails): PatientVisit => {
  const visit: PatientVisit = {
    id: v.id, queueNumber: v.queue_number, checkinAt: v.checkin_at, reasonCategory: v.reason_category, status: v.status, urgent: v.urgent,
  };
  if ('symptoms' in v) {
    visit.details = { symptoms: v.symptoms, notes: v.notes, icd10Codes: v.icd10_codes, outcome: v.outcome, clinicianName: v.clinician_name };
  }
  return visit;
};

/** OP9 */
export async function searchPatients(query: string): Promise<PatientSummary[]> {
  const response = await apiRequest<{ patients: PatientSearchItem[] }>(`/patients?q=${encodeURIComponent(query)}`, { token: await getAccessToken() });
  return response.patients.map(toSummary);
}

/** OP10 */
export async function getPatientFile(id: string): Promise<{ patient: PatientRecord; visits: PatientVisit[] }> {
  const response = await apiRequest<PatientFileResponse>(`/patients/${encodeURIComponent(id)}`, { token: await getAccessToken() });
  return { patient: toRecord(response.patient), visits: response.visits.map(toVisit) };
}

/** OP11 */
export async function createPatient(body: NewPatientInput): Promise<PatientRecord> {
  return toRecord(await apiRequest<ApiPatientRecord>('/patients', { method: 'POST', token: await getAccessToken(), body }));
}

/** OP12 */
export async function updatePatient(id: string, body: PatientInput): Promise<PatientRecord> {
  return toRecord(await apiRequest<ApiPatientRecord>(`/patients/${encodeURIComponent(id)}`, { method: 'PATCH', token: await getAccessToken(), body }));
}
