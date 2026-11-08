'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { formatSastDate } from '@pholo/types';
import { useCheckin } from '@/components/CheckinProvider';
import { useSession } from '@/components/SessionProvider';
import { useClock } from '@/components/useClock';
import { DoneScreen } from './DoneScreen';

/** S5 wired to the result of OP4. "Done" and the 15-second timer erase everything and show S2. */
export default function DonePage() {
  const router = useRouter();
  const { profile } = useSession();
  const { result, reset } = useCheckin();
  const now = useClock();

  useEffect(() => {
    if (!result) router.replace('/checkin');
  }, [result, router]);
  if (!result) return null;

  return (
    <DoneScreen
      facilityName={profile?.facilityName ?? ''}
      dateText={now ? formatSastDate(now) : ''}
      result={result}
      onDone={() => {
        reset();
        router.replace('/checkin');
      }}
    />
  );
}
