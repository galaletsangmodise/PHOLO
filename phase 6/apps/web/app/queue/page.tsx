'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { QUEUE_REFRESH_MS } from '@pholo/types';
import { ApiError } from '@/components/api';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { takeFlash } from '@/components/flash';
import { MESSAGES } from '@/components/messages';
import { callNext, getQueue, markLeft, type QueueTab, type QueueVisit } from '@/components/queueApi';
import { useSession } from '@/components/SessionProvider';
import { useGuardedApi } from '@/components/useGuardedApi';
import { useOnlineStatus } from '@/components/useOnlineStatus';
import { QueueScreen, type QueueState } from './QueueScreen';

/** S6 wired to OP5 (list, every 5 seconds), OP6 (call next) and OP8 (mark as left, through M4). */
export default function QueuePage() {
  const router = useRouter();
  const { profile, logout } = useSession();
  const guarded = useGuardedApi();
  const online = useOnlineStatus();
  const [tab, setTab] = useState<QueueTab>('active');
  const [state, setState] = useState<QueueState>({ kind: 'loading' });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toast, setToast] = useState<string | undefined>();
  const [calling, setCalling] = useState(false);
  const [leaving, setLeaving] = useState<QueueVisit | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState(false);
  const latest = useRef(0);
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const allowed = profile?.role === 'Reception' || profile?.role === 'Clinical';

  /** `quiet` keeps the list on screen while it is read again (the 5-second refresh and "Refresh"). */
  const load = useCallback(
    async (which: QueueTab, quiet: boolean) => {
      latest.current += 1;
      const mine = latest.current;
      if (!quiet) setState({ kind: 'loading' });
      try {
        const answer = await guarded(() => getQueue(which));
        if (mine !== latest.current) return;
        setNowMs(Date.now());
        setState({ kind: 'ready', ...answer });
      } catch {
        if (mine === latest.current && !quiet) setState({ kind: 'error' });
      }
    },
    [guarded],
  );

  useEffect(() => {
    if (allowed) void load(tab, false);
  }, [allowed, tab, load]);

  // Every 5 seconds; paused while the computer is offline.
  useEffect(() => {
    if (!allowed || !online) return undefined;
    const timer = setInterval(() => void load(tabRef.current, true), QUEUE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [allowed, online, load]);

  // "Visit completed." arrives from S9.
  useEffect(() => {
    const message = takeFlash();
    if (message) setToast(message);
  }, []);

  if (!profile || (profile.role !== 'Reception' && profile.role !== 'Clinical')) return null;

  const callNextPatient = async () => {
    setCalling(true);
    try {
      const called = await guarded(() => callNext());
      if (!called.noneWaiting) setToast(`Calling number ${called.queueNumber}: ${called.firstName} ${called.surname}`);
      await load(tabRef.current, true);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 0)) setToast(MESSAGES.serverProblem);
    } finally {
      setCalling(false);
    }
  };

  const confirmLeft = async () => {
    if (!leaving) return;
    setLeaveBusy(true);
    setLeaveError(false);
    try {
      await guarded(() => markLeft(leaving.id));
      setLeaving(null);
      setToast('Marked as left.');
      await load(tabRef.current, true);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        // Somebody else changed this Visit first: close M4, show why, and read the list again.
        setLeaving(null);
        setToast(error.message);
        await load(tabRef.current, true);
      } else if (!(error instanceof ApiError && error.status === 401)) {
        setLeaveError(true);
      }
    } finally {
      setLeaveBusy(false);
    }
  };

  return (
    <>
      <QueueScreen
        role={profile.role}
        fullName={profile.fullName}
        tab={tab}
        state={state}
        nowMs={nowMs}
        toast={toast}
        calling={calling}
        onTab={setTab}
        onCallNext={callNextPatient}
        onMarkLeft={(visit) => {
          setLeaveError(false);
          setLeaving(visit);
        }}
        onStart={(visitId) => router.push(`/visits/${visitId}`)}
        onContinue={(visitId) => router.push(`/visits/${visitId}`)}
        onRefresh={() => void load(tab, true)}
        onTryAgain={() => void load(tab, false)}
        onToastDone={() => setToast(undefined)}
        onLogout={logout}
      />
      {leaving ? (
        <ConfirmDialog
          kind="markLeft"
          queueNumber={leaving.queueNumber}
          patientName={`${leaving.firstName} ${leaving.surname}`}
          loading={leaveBusy}
          error={leaveError}
          offline={!online}
          onConfirm={confirmLeft}
          onCancel={() => setLeaving(null)}
        />
      ) : null}
    </>
  );
}
