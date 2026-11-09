'use client';

import { CheckinHeader } from '@/components/CheckinHeader';
import { useSession } from '@/components/SessionProvider';

/** S2 Check-in start: an empty shell in Phase 3 (only its title). Replaced by the real screen in Phase 4. */
export default function CheckinStartPage() {
  const { profile } = useSession();
  return (
    <main>
      <CheckinHeader facilityName={profile?.facilityName ?? ''} dateTimeText="" />
      <h1 className="p-s3 text-tablet-title text-text">Check-in</h1>
    </main>
  );
}
