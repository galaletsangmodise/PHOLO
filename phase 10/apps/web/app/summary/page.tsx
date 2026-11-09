'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { SUMMARY_REFRESH_MS } from '@pholo/types';
import { useSession } from '@/components/SessionProvider';
import { getSummary } from '@/components/summaryApi';
import { useGuardedApi } from '@/components/useGuardedApi';
import { useOnlineStatus } from '@/components/useOnlineStatus';
import { SummaryScreen, type SummaryState } from './SummaryScreen';

/** S10 wired to OP17: loads on open and again every 5 seconds (paused while offline). Manager only. */
export default function SummaryPage() {
  const { profile, logout } = useSession();
  const guarded = useGuardedApi();
  const online = useOnlineStatus();
  const [state, setState] = useState<SummaryState>({ kind: 'loading' });
  const latest = useRef(0);
  const allowed = profile?.role === 'Manager';

  /** `quiet` keeps the numbers on screen while they are read again (the 5-second refresh and "Refresh"). */
  const load = useCallback(
    async (quiet: boolean) => {
      latest.current += 1;
      const mine = latest.current;
      if (!quiet) setState({ kind: 'loading' });
      try {
        const summary = await guarded(() => getSummary());
        if (mine === latest.current) setState({ kind: 'ready', summary, updatedAtMs: Date.now() });
      } catch {
        if (mine === latest.current && !quiet) setState({ kind: 'error' });
      }
    },
    [guarded],
  );

  useEffect(() => {
    if (allowed) void load(false);
  }, [allowed, load]);

  useEffect(() => {
    if (!allowed || !online) return undefined;
    const timer = setInterval(() => void load(true), SUMMARY_REFRESH_MS);
    return () => clearInterval(timer);
  }, [allowed, online, load]);

  if (!profile || profile.role !== 'Manager') return null;
  return (
    <SummaryScreen
      fullName={profile.fullName}
      facilityName={profile.facilityName}
      state={state}
      offline={!online}
      onRefresh={() => void load(true)}
      onTryAgain={() => void load(false)}
      onLogout={logout}
    />
  );
}
