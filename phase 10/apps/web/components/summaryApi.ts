import { REASON_CATEGORIES, type ReasonCategory, type SummaryResponse } from '@pholo/types';
import { getAccessToken } from './accessToken';
import { apiRequest } from './api';

export interface Summary {
  checkedIn: number;
  completed: number;
  stillWaiting: number;
  left: number;
  /** Whole minutes, or null while no Visit has been called today. */
  averageWaitMinutes: number | null;
  waitedOver3Hours: number;
  helpedByDoorAssistant: number;
  /** One row per reason, the most frequent first (ties in the order of the Check-in tablet). */
  reasons: Array<{ reason: ReasonCategory; count: number }>;
}

/** OP17. Only the known numbers and the six reasons are read, whatever else the server sends. */
export async function getSummary(): Promise<Summary> {
  const answer = await apiRequest<SummaryResponse>('/summary', { token: await getAccessToken() });
  const reasons = REASON_CATEGORIES.map((reason, index) => ({ reason, count: Number(answer.reasons?.[reason]) || 0, index }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ reason, count }) => ({ reason, count }));
  return {
    checkedIn: answer.checked_in,
    completed: answer.completed,
    stillWaiting: answer.still_waiting,
    left: answer.left,
    averageWaitMinutes: answer.average_wait_minutes ?? null,
    waitedOver3Hours: answer.waited_over_3_hours,
    helpedByDoorAssistant: answer.helped_by_door_assistant,
    reasons,
  };
}
