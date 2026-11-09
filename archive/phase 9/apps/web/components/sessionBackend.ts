import { ApiError, apiRequest } from './api';
import type { Profile, LoginResult, SessionBackend } from './SessionProvider';
import { getSupabase } from './supabaseClient';
import type { Role } from './roles';

interface ProfileResponse { role: Role; full_name: string; facility_name: string }
interface LoginResponse {
  session: { access_token: string; refresh_token: string };
  profile: ProfileResponse;
}

const toProfile = (p: ProfileResponse): Profile => ({ role: p.role, fullName: p.full_name, facilityName: p.facility_name });

/** The real backend: log in through the API (OP1), keep the session with Supabase (OP2), read the profile (OP3). */
export const defaultBackend: SessionBackend = {
  async login(email, password): Promise<LoginResult> {
    try {
      const result = await apiRequest<LoginResponse>('/auth/login', { body: { email, password } });
      const { error } = await getSupabase().auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      });
      if (error) return { ok: false, error: 'server' };
      return { ok: true, profile: toProfile(result.profile) };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 401) return { ok: false, error: 'credentials' };
        if (error.status === 429) return { ok: false, error: 'locked' };
      }
      return { ok: false, error: 'server' };
    }
  },

  async logout() {
    await getSupabase().auth.signOut();
  },

  async restore() {
    try {
      const { data } = await getSupabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return null;
      return toProfile(await apiRequest<ProfileResponse>('/auth/me', { token }));
    } catch {
      return null;
    }
  },
};
