import type { Outcome, PaperFileStatus, ReasonCategory, VisitDetailResponse, VisitFormValues, VisitStatus } from '@pholo/types';
import { getAccessToken } from './accessToken';
import { apiRequest } from './api';

export interface VisitDetail {
  visit: {
    id: string;
    patientId: string;
    queueNumber: number;
    checkinAt: string;
    reasonCategory: ReasonCategory;
    urgent: boolean;
    status: VisitStatus;
    symptoms: string | null;
    notes: string | null;
    icd10Codes: string | null;
    outcome: Outcome | null;
  };
  patient: {
    id: string;
    fileNumber: string;
    firstName: string;
    surname: string;
    dateOfBirth: string;
    paperFileStatus: PaperFileStatus;
    chronicConditions: string | null;
    allergies: string | null;
    currentMedication: string | null;
  };
}

const path = (visitId: string, ending = ''): string => `/visits/${encodeURIComponent(visitId)}${ending}`;

/** OP14 */
export async function getVisit(visitId: string): Promise<VisitDetail> {
  const { visit, patient } = await apiRequest<VisitDetailResponse>(path(visitId), { token: await getAccessToken() });
  return {
    visit: {
      id: visit.id, patientId: visit.patient_id, queueNumber: visit.queue_number, checkinAt: visit.checkin_at, reasonCategory: visit.reason_category,
      urgent: visit.urgent, status: visit.status, symptoms: visit.symptoms, notes: visit.notes, icd10Codes: visit.icd10_codes, outcome: visit.outcome,
    },
    patient: {
      id: patient.id, fileNumber: patient.file_number, firstName: patient.first_name, surname: patient.surname, dateOfBirth: patient.date_of_birth,
      paperFileStatus: patient.paper_file_status, chronicConditions: patient.chronic_conditions, allergies: patient.allergies,
      currentMedication: patient.current_medication,
    },
  };
}

/** OP15 */
export async function saveDraft(visitId: string, values: VisitFormValues): Promise<void> {
  await apiRequest(path(visitId, '/draft'), { method: 'PUT', token: await getAccessToken(), body: values });
}

/** OP16 */
export async function completeVisit(visitId: string, values: VisitFormValues): Promise<void> {
  await apiRequest(path(visitId, '/complete'), { method: 'POST', token: await getAccessToken(), body: values });
}
