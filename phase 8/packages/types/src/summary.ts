import type { ReasonCategory } from './domain';

/** S10 asks for the numbers again every 5 seconds (PRD 11.3). */
export const SUMMARY_REFRESH_MS = 5000;

export const SUMMARY_MESSAGES = {
  loadFailed: 'We could not load the summary. Please try again.',
  noCheckins: 'No check-ins yet today. Numbers will appear after the first patient checks in.',
} as const;

/** OP17: counts, the average and the reasons for today. There is no Patient name anywhere (SEC12, SEC22). */
export interface SummaryResponse {
  checked_in: number;
  completed: number;
  still_waiting: number;
  left: number;
  /** Whole minutes; null while no Visit has been called today (Section 18, #14). */
  average_wait_minutes: number | null;
  waited_over_3_hours: number;
  helped_by_door_assistant: number;
  reasons: Record<ReasonCategory, number>;
}
