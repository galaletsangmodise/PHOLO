import type { CallNextResponse, PaperFileStatus, QueueCounts as ApiQueueCounts, QueueResponse, QueueRow, QueueTab, ReasonCategory, VisitStatus } from '@pholo/types';
import { getAccessToken } from './accessToken';
import { apiRequest } from './api';

export type { QueueTab };

export interface QueueVisit {
  id: string;
  patientId: string;
  queueNumber: number;
  firstName: string;
  surname: string;
  dateOfBirth: string;
  reasonCategory: ReasonCategory;
  urgent: boolean;
  assisted: boolean;
  status: VisitStatus;
  paperFileStatus: PaperFileStatus;
  checkinAt: string;
  calledAt: string | null;
  completedAt: string | null;
  leftAt: string | null;
}

export interface QueueCounts {
  /** Waiting and Called Visits. */
  waiting: number;
  inConsultation: number;
  completed: number;
  /** Visits nobody has called yet. */
  uncalled: number;
}

export interface CalledVisit {
  noneWaiting: boolean;
  visitId?: string;
  queueNumber?: number;
  firstName?: string;
  surname?: string;
}

const toVisit = (row: QueueRow): QueueVisit => ({
  id: row.id,
  patientId: row.patient_id,
  queueNumber: row.queue_number,
  firstName: row.first_name,
  surname: row.surname,
  dateOfBirth: row.date_of_birth,
  reasonCategory: row.reason_category,
  urgent: row.urgent,
  assisted: row.assisted,
  status: row.status,
  paperFileStatus: row.paper_file_status,
  checkinAt: row.checkin_at,
  calledAt: row.called_at,
  completedAt: row.completed_at,
  leftAt: row.left_at,
});

const toCounts = (counts: ApiQueueCounts): QueueCounts => ({
  waiting: counts.waiting,
  inConsultation: counts.in_consultation,
  completed: counts.completed,
  uncalled: counts.uncalled,
});

/** OP5 */
export async function getQueue(tab: QueueTab): Promise<{ visits: QueueVisit[]; counts: QueueCounts }> {
  const response = await apiRequest<QueueResponse>(`/queue?tab=${tab}`, { token: await getAccessToken() });
  return { visits: response.visits.map(toVisit), counts: toCounts(response.counts) };
}

/** OP6 */
export async function callNext(): Promise<CalledVisit> {
  const response = await apiRequest<CallNextResponse>('/queue/call-next', { method: 'POST', token: await getAccessToken() });
  return {
    noneWaiting: response.none_waiting,
    visitId: response.visit_id,
    queueNumber: response.queue_number,
    firstName: response.first_name,
    surname: response.surname,
  };
}

/** OP8 */
export async function markLeft(visitId: string): Promise<void> {
  await apiRequest(`/queue/${encodeURIComponent(visitId)}/left`, { method: 'POST', token: await getAccessToken() });
}

/** OP7: "Start consultation" makes a Called Visit In consultation before S9 opens. */
export async function startConsultation(visitId: string): Promise<void> {
  await apiRequest(`/visits/${encodeURIComponent(visitId)}/start`, { method: 'POST', token: await getAccessToken() });
}
