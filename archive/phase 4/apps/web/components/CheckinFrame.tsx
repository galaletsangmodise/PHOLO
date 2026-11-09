'use client';

import type { ReactNode } from 'react';
import { CheckinHeader } from './CheckinHeader';
import { MESSAGES } from './messages';
import { OfflineBanner } from './OfflineBanner';

interface CheckinFrameProps {
  facilityName: string;
  dateTimeText: string;
  step?: 1 | 2;
  offline: boolean;
  /** Red on S2, amber on the other Check-in screens (Section 18, #18). */
  bannerTone?: 'red' | 'amber';
  onLogoLongPress?: () => void;
  children: ReactNode;
}

/** The page around S2 to S5: the Check-in Header, the offline banner and the content column. */
export function CheckinFrame({ facilityName, dateTimeText, step, offline, bannerTone = 'amber', onLogoLongPress, children }: CheckinFrameProps) {
  return (
    <main className="min-h-screen bg-background">
      <CheckinHeader facilityName={facilityName} dateTimeText={dateTimeText} step={step} onLogoLongPress={onLogoLongPress} />
      <OfflineBanner message={MESSAGES.offlineCheckin} tone={bannerTone} offline={offline} />
      <div className="mx-auto flex w-full max-w-content-tablet flex-col gap-s4 px-s6 py-s4">{children}</div>
    </main>
  );
}
