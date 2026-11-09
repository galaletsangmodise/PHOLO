import type { ReactNode } from 'react';
import { SessionContext, type Profile, type SessionValue } from '@/components/SessionProvider';

export const PROFILES = {
  checkin: { role: 'Check-in', fullName: 'Ubuntu Clinic Tablet 1', facilityName: 'Ubuntu Community Clinic' },
  reception: { role: 'Reception', fullName: 'Busisiwe Naidoo', facilityName: 'Ubuntu Community Clinic' },
  clinical: { role: 'Clinical', fullName: 'Nomsa Khumalo', facilityName: 'Ubuntu Community Clinic' },
  manager: { role: 'Manager', fullName: 'Farouk Patel', facilityName: 'Ubuntu Community Clinic' },
} satisfies Record<string, Profile>;

/** A session value for tests; every function is a jest mock the test can inspect. */
export function fakeSession(overrides: Partial<SessionValue> = {}): SessionValue {
  return {
    status: 'out',
    profile: null,
    sessionEnded: false,
    notAllowed: false,
    login: jest.fn(async () => ({ ok: false as const, error: 'credentials' as const })),
    logout: jest.fn(async () => {}),
    clearNotAllowed: jest.fn(),
    flagNotAllowed: jest.fn(),
    ...overrides,
  };
}

export function WithSession({ value, children }: { value: SessionValue; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
