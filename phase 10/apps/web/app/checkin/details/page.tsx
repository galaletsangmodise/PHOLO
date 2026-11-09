'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { formatSastDate } from '@pholo/types';
import { useCheckin } from '@/components/CheckinProvider';
import { PrivacyNoticeModal } from '@/components/PrivacyNoticeModal';
import { useSession } from '@/components/SessionProvider';
import { useClock } from '@/components/useClock';
import { useIdleTimer } from '@/components/useIdleTimer';
import { IDLE_MS } from '../timers';
import { DetailsScreen } from './DetailsScreen';

/** S3 wired to the answers, the 2-minute timer and the Privacy Notice. */
export default function DetailsPage() {
  const router = useRouter();
  const { profile } = useSession();
  const { started, reset } = useCheckin();
  const now = useClock();
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const goHome = useCallback(() => {
    reset();
    router.replace('/checkin');
  }, [reset, router]);

  useIdleTimer(IDLE_MS, goHome);
  // After a reload nothing was kept, so the Patient starts again at S2 (T-EDGE-2).
  useEffect(() => {
    if (!started) router.replace('/checkin');
  }, [started, router]);
  if (!started) return null;

  return (
    <>
      <DetailsScreen
        facilityName={profile?.facilityName ?? ''}
        dateText={now ? formatSastDate(now) : ''}
        onBack={goHome}
        onNext={() => router.push('/checkin/visit')}
        onOpenPrivacy={() => setPrivacyOpen(true)}
      />
      {privacyOpen ? <PrivacyNoticeModal size="tablet" onClose={() => setPrivacyOpen(false)} /> : null}
    </>
  );
}
