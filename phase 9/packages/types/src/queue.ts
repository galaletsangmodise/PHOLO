import type { PaperFileStatus, ReasonCategory, VisitStatus } from './domain';

/** S6 asks for the Queue again every 5 seconds (PRD 8.2, S6). */
export const QUEUE_REFRESH_MS = 5000;

export const QUEUE_MESSAGES = {
  loadFailed: 'We could not load the queue. Please try again.',
  noOneWaiting: 'No one is waiting.',
  visitNotFound: 'We could not find this visit.',
  leftRefused: 'This visit can no longer be marked as left.',
} as const;

export type QueueTab = 'active' | 'done';

/** One Visit on S6. It holds no symptoms, notes, ICD-10 codes or outcome (SEC11). */
export interface QueueRow {
  id: string;
  patient_id: string;
  queue_number: number;
  first_name: string;
  surname: string;
  date_of_birth: string;
  reason_category: ReasonCategory;
  urgent: boolean;
  assisted: boolean;
  status: VisitStatus;
  paper_file_status: PaperFileStatus;
  checkin_at: string;
  called_at: string | null;
  completed_at: string | null;
  left_at: string | null;
}

export interface QueueCounts {
  /** The chip "Waiting": Waiting and Called Visits (there is no Called chip). */
  waiting: number;
  in_consultation: number;
  completed: number;
  /** Visits that nobody has called yet: "Call next patient" is disabled when this is 0. */
  uncalled: number;
}

export interface QueueResponse {
  visits: QueueRow[];
  counts: QueueCounts;
}

/** OP6: the Visit that was called, or "none waiting". */
export interface CallNextResponse {
  none_waiting: boolean;
  visit_id?: string;
  queue_number?: number;
  patient_id?: string;
  first_name?: string;
  surname?: string;
}
