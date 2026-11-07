'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Role } from './roles';
import { defaultBackend } from './sessionBackend';

export interface Profile {
  role: Role;
  fullName: string;
  facilityName: string;
}

export type LoginResult = { ok: true; profile: Profile } | { ok: false; error: 'credentials' | 'locked' | 'server' };

export interface SessionBackend {
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  /** The saved session of this browser, if there is a valid one. */
  restore(): Promise<Profile | null>;
}

export interface SessionValue {
  status: 'loading' | 'out' | 'in';
  profile: Profile | null;
  /** True after the inactivity timer ended the session: S1 shows "Your session has ended. Please log in again." */
  sessionEnded: boolean;
  /** True after a role opened a screen it may not open: the main screen shows the not-allowed toast. */
  notAllowed: boolean;
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  flagNotAllowed(): void;
  clearNotAllowed(): void;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside a SessionProvider.');
  return value;
}

/** BR11: Reception, Clinical and Manager are signed out after 15 minutes without activity. Check-in is not. */
export const INACTIVITY_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ['keydown', 'mousemove', 'pointerdown', 'touchstart'] as const;

interface SessionProviderProps {
  children: ReactNode;
  backend?: SessionBackend;
  inactivityMs?: number;
}

export function SessionProvider({ children, backend = defaultBackend, inactivityMs = INACTIVITY_MS }: SessionProviderProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const backendRef = useRef(backend);
  backendRef.current = backend;

  const [status, setStatus] = useState<SessionValue['status']>('loading');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [notAllowed, setNotAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    backendRef.current
      .restore()
      .then((restored) => {
        if (cancelled) return;
        setProfile(restored);
        setStatus(restored ? 'in' : 'out');
      })
      .catch(() => {
        if (!cancelled) setStatus('out');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await backendRef.current.login(email, password);
    if (result.ok) {
      setProfile(result.profile);
      setStatus('in');
      setSessionEnded(false);
    }
    return result;
  }, []);

  const logout = useCallback(async () => {
    try {
      await backendRef.current.logout();
    } finally {
      setProfile(null);
      setStatus('out');
      setSessionEnded(false);
      setNotAllowed(false);
    }
  }, []);

  const role = profile?.role;
  const timed = status === 'in' && role !== undefined && role !== 'Check-in';
  useEffect(() => {
    if (!timed) return undefined;
    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      backendRef.current.logout().catch(() => {});
      setProfile(null);
      setStatus('out');
      setSessionEnded(true);
      routerRef.current.replace('/login');
    };
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, inactivityMs);
    };
    restart();
    ACTIVITY_EVENTS.forEach((name) => document.addEventListener(name, restart, true));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => document.removeEventListener(name, restart, true));
    };
  }, [timed, inactivityMs]);

  const flagNotAllowed = useCallback(() => setNotAllowed(true), []);
  const clearNotAllowed = useCallback(() => setNotAllowed(false), []);

  const value = useMemo<SessionValue>(
    () => ({ status, profile, sessionEnded, notAllowed, login, logout, flagNotAllowed, clearNotAllowed }),
    [status, profile, sessionEnded, notAllowed, login, logout, flagNotAllowed, clearNotAllowed],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
