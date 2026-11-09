'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatSastDate, formatSastTime, formatSastWeekday } from '@pholo/types';
import { useCheckin } from '@/components/CheckinProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PrivacyNoticeModal } from '@/components/PrivacyNoticeModal';
import { useSession } from '@/components/SessionProvider';
import { useClock } from '@/components/useClock';
import { StartScreen } from './StartScreen';

/** S2 with its two modals: the Privacy Notice (M1) and "Log out of this tablet?" (M4). */
export default function CheckinStartPage() {
  const router = useRouter();
  const { profile, logout } = useSession();
  const { start, reset } = useCheckin();
  const now = useClock();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  // Coming back to S2 (Done, a timer, "Back") always leaves it empty.
  useEffect(() => reset(), [reset]);

  const dateTimeText = now ? `${formatSastWeekday(now)} ${formatSastDate(now)} · ${formatSastTime(now)}` : '';

  const begin = (assisted: boolean) => {
    start(assisted);
    router.push('/checkin/details');
  };

  const confirmLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <>
      <StartScreen
        facilityName={profile?.facilityName ?? ''}
        dateTimeText={dateTimeText}
        onCheckIn={() => begin(false)}
        onCheckInWithHelp={() => begin(true)}
        onOpenPrivacy={() => setPrivacyOpen(true)}
        onLogoLongPress={() => setLogoutOpen(true)}
      />
      {privacyOpen ? <PrivacyNoticeModal size="tablet" onClose={() => setPrivacyOpen(false)} /> : null}
      {logoutOpen ? <ConfirmDialog kind="logoutTablet" onConfirm={confirmLogout} onCancel={() => setLogoutOpen(false)} /> : null}
    </>
  );
}
