import { getSupabase } from './supabaseClient';

/** The token of the logged-in user, sent to the API as "Authorization: Bearer ..." (plan Section 18, #8). */
export async function getAccessToken(): Promise<string | undefined> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token;
}
