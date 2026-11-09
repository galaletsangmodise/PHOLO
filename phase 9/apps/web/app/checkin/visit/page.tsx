'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { formatSastDate } from '@pholo/types';
import { ApiError } from '@/components/api';
import { submitCheckin } from '@/components/checkinApi';
import { useCheckin } from '@/components/CheckinProvider';
import { PrivacyNoticeModal } from '@/components/PrivacyNoticeModal';
import { useSession } from '@/components/SessionProvider';
import { useClock } from '@/components/useClock';
import { useIdleTimer } from '@/components/useIdleTimer';
import { IDLE_MS } from '../timers';
import { VisitScreen } from './VisitScreen';

/** S4 wired to OP4, the 2-minute timer and the Privacy Notice. On success S5 replaces S4 in the history. */
export default function VisitPage() {
  const router = useRouter();
  const { profile, logout } = useSession();
  const { answers, started, setResult, reset } = useCheckin();
  const now = useClock();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const goHome = useCallback(() => {
    reset();
    router.replace('/checkin');
  }, [reset, router]);

  useIdleTimer(IDLE_MS, goHome);
  useEffect(() => {
    if (!started) router.replace('/checkin');
  }, [started, router]);
  if (!started) return null;

  const submit = async () => {
    setLoading(true);
    setError(undefined);
    try {
      setResult(await submitCheckin(answers));
      router.replace('/checkin/done');
    } catch (caught) {
      setLoading(false);
      if (caught instanceof ApiError && caught.status === 401) {
        await logout();
        router.replace('/login');
      } else if (caught instanceof ApiError && caught.status !== 0) {
        setError(caught.message); // offline (status 0) is shown by the banner instead
      }
    }
  };

  return (
    <>
      <VisitScreen
        facilityName={profile?.facilityName ?? ''}
        dateText={now ? formatSastDate(now) : ''}
        loading={loading}
        error={error}
        onBack={() => router.push('/checkin/details')}
        onSubmit={submit}
        onOpenPrivacy={() => setPrivacyOpen(true)}
      />
      {privacyOpen ? <PrivacyNoticeModal size="tablet" onClose={() => setPrivacyOpen(false)} /> : null}
    </>
  );
}
