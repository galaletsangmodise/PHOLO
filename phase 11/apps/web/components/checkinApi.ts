import { getAccessToken } from './accessToken';
import { apiRequest } from './api';
import { checkinBody } from './checkinRules';
import type { CheckinAnswers, CheckinResult } from './CheckinProvider';

interface CheckinResponse {
  queue_number: number;
  already_checked_in: boolean;
  urgent: boolean;
  has_file: boolean;
}

/** OP4: sends the answers and gets back the Queue number only. */
export async function submitCheckin(answers: CheckinAnswers): Promise<CheckinResult> {
  const response = await apiRequest<CheckinResponse>('/checkin', { token: await getAccessToken(), body: checkinBody(answers) });
  return {
    queueNumber: response.queue_number,
    alreadyCheckedIn: response.already_checked_in,
    urgent: response.urgent,
    hasFile: response.has_file,
  };
}
