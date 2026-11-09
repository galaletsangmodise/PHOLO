import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { LoginLock } from './login-lock';
import { MESSAGES, type AuthUser, type ProfileResponse, type SessionResponse, type StaffRole } from './auth.types';
import { SupabaseService } from './supabase.service';

interface StaffRow {
  id: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  facility_id: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly lock: LoginLock,
  ) {}

  /** OP1 Log in: 60-second lock per email after 5 wrong passwords (BR12), then Supabase Auth. */
  async login(email: unknown, password: unknown): Promise<{ session: SessionResponse; profile: ProfileResponse }> {
    if (typeof email !== 'string' || typeof password !== 'string' || email.trim() === '' || password === '') {
      throw new HttpException(MESSAGES.wrongDetails, HttpStatus.UNAUTHORIZED);
    }
    const address = email.trim();
    if (this.lock.isLocked(address)) {
      throw new HttpException(MESSAGES.tooManyTries, HttpStatus.TOO_MANY_REQUESTS);
    }

    let result;
    try {
      result = await this.supabase.anon().auth.signInWithPassword({ email: address, password });
    } catch (err) {
      console.error('LOGIN CATCH:', err);
      throw new HttpException(MESSAGES.serverProblem, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    const { data, error } = result;
    if (error) {
      if (error.status === 400 || error.code === 'invalid_credentials') {
        console.error('LOGIN SUPABASE ERROR:', error);
        this.lock.recordFailure(address);
        throw new HttpException(MESSAGES.wrongDetails, HttpStatus.UNAUTHORIZED);
      }
      console.error('LOGIN NO SESSION:', data);
      throw new HttpException(MESSAGES.serverProblem, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    if (!data.session || !data.user) {
      throw new HttpException(MESSAGES.serverProblem, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // SEC26: a disabled account, or one with no StaffProfile, cannot log in.
    const user = await this.profileFor(data.session.access_token, data.user.id);
    if (!user) {
      throw new HttpException(MESSAGES.wrongDetails, HttpStatus.UNAUTHORIZED);
    }

    this.lock.reset(address);
    const { access_token, refresh_token, expires_in, expires_at, token_type } = data.session;
    return {
      session: { access_token, refresh_token, expires_in, expires_at, token_type },
      profile: { role: user.role, full_name: user.fullName, facility_name: user.facilityName },
    };
  }

  /** The token check used by every operation: a valid token for an active StaffProfile, else "session ended". */
  async authenticate(token: string | undefined): Promise<AuthUser> {
    if (!token) throw new HttpException(MESSAGES.sessionEnded, HttpStatus.UNAUTHORIZED);
    let userId: string | undefined;
    try {
      const { data, error } = await this.supabase.anon().auth.getUser(token);
      userId = error ? undefined : data.user?.id;
    } catch {
      userId = undefined;
    }
    if (!userId) throw new HttpException(MESSAGES.sessionEnded, HttpStatus.UNAUTHORIZED);

    const user = await this.profileFor(token, userId);
    if (!user) throw new HttpException(MESSAGES.sessionEnded, HttpStatus.UNAUTHORIZED);
    return user;
  }

  /** Reads the user's own StaffProfile and Facility name with the user's token (so Row-Level Security applies). */
  private async profileFor(token: string, userId: string): Promise<AuthUser | null> {
    const client = this.supabase.forToken(token);
    const profile = await client
      .from('staff_profiles')
      .select('id, full_name, role, active, facility_id')
      .eq('id', userId)
      .maybeSingle();
    const row = profile.data as StaffRow | null;
    if (profile.error || !row || !row.active) return null;

    // A disabled account gets no Facility from the policies, so the name is read only for active ones.
    const facility = await client.from('facilities').select('name').eq('id', row.facility_id).maybeSingle();
    const name = (facility.data as { name: string } | null)?.name;
    if (facility.error || !name) return null;

    return { id: row.id, role: row.role, fullName: row.full_name, facilityId: row.facility_id, facilityName: name, token };
  }
}
