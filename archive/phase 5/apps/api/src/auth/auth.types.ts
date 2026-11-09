export type StaffRole = 'Check-in' | 'Reception' | 'Clinical' | 'Manager';

/** The logged-in user the guards attach to the request. */
export interface AuthUser {
  id: string;
  role: StaffRole;
  fullName: string;
  facilityId: string;
  facilityName: string;
  token: string;
}

export interface ProfileResponse {
  role: StaffRole;
  full_name: string;
  facility_name: string;
}

export interface SessionResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
}

export const MESSAGES = {
  sessionEnded: 'Your session has ended. Please log in again.',
  notAllowed: 'You are not allowed to open this page.',
  wrongDetails: 'Email or password is not correct. Try again.',
  tooManyTries: 'Too many tries. Wait 60 seconds and try again.',
  serverProblem: 'Something went wrong on our side. Please try again.',
} as const;
