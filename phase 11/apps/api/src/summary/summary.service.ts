import { HttpException, Injectable } from '@nestjs/common';
import { REASON_CATEGORIES, SUMMARY_MESSAGES, type ReasonCategory, type SummaryResponse } from '@pholo/types';
import { MESSAGES, type AuthUser } from '../auth/auth.types';
import { SupabaseService } from '../auth/supabase.service';

/** A count from the database function; anything that is not a whole number counts as 0. */
const count = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.floor(number) : 0;
};

@Injectable()
export class SummaryService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * OP17 (BR15, SEC12, SEC22): the database function daily_summary checks that the caller is a Manager and counts today's Visits
   * (00:00 to 23:59 SAST) in the caller's Facility. Only the known counts and the six reasons leave here, so no name can.
   */
  async get(user: AuthUser): Promise<SummaryResponse> {
    const { data, error } = await this.supabase.forToken(user.token).rpc('daily_summary');
    if (error) {
      if (error.code === '42501') throw new HttpException({ message: MESSAGES.notAllowed }, 403);
      throw new HttpException({ message: SUMMARY_MESSAGES.loadFailed }, 500);
    }
    const raw = (data ?? {}) as Record<string, unknown>;
    const reasons = (typeof raw.reasons === 'object' && raw.reasons !== null ? raw.reasons : {}) as Record<string, unknown>;
    const average = raw.average_wait_minutes;
    return {
      checked_in: count(raw.checked_in),
      completed: count(raw.completed),
      still_waiting: count(raw.still_waiting),
      left: count(raw.left),
      average_wait_minutes: average === null || average === undefined ? null : count(average),
      waited_over_3_hours: count(raw.waited_over_3_hours),
      helped_by_door_assistant: count(raw.helped_by_door_assistant),
      reasons: Object.fromEntries(REASON_CATEGORIES.map((reason) => [reason, count(reasons[reason])])) as Record<ReasonCategory, number>,
    };
  }
}
