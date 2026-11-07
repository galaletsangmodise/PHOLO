'use client';

import { useEffect, useRef } from 'react';
import { Logo } from './Logo';

/** Press and hold the logo for 3 seconds to open "Log out of this tablet?" (PRD 8.3). */
const LONG_PRESS_MS = 3000;

interface CheckinHeaderProps {
  facilityName: string;
  dateTimeText: string;
  /** "Step 1 of 2" or "Step 2 of 2" on S3 and S4. */
  step?: 1 | 2;
  onLogoLongPress?: () => void;
}

/** The header of the Check-in screens (S2 to S5). It has no menu. */
export function CheckinHeader({ facilityName, dateTimeText, step, onLogoLongPress }: CheckinHeaderProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPress = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const startPress = () => {
    cancelPress();
    timer.current = setTimeout(() => {
      timer.current = null;
      onLogoLongPress?.();
    }, LONG_PRESS_MS);
  };

  useEffect(() => cancelPress, []);

  return (
    <header className="flex items-center justify-between gap-s3 border-b border-borderLight bg-surface px-s3 py-s2">
      <div className="flex items-center gap-s3">
        <div
          data-testid="logo-hold-target"
          onPointerDown={startPress}
          onPointerUp={cancelPress}
          onPointerLeave={cancelPress}
          onPointerCancel={cancelPress}
          onContextMenu={(event) => event.preventDefault()}
          className="select-none"
        >
          <Logo />
        </div>
        <div className="flex flex-col">
          <span className="text-tablet-small font-bold text-text">{facilityName}</span>
          <span className="text-tablet-small text-textSecondary">{dateTimeText}</span>
        </div>
      </div>
      {step ? <span className="text-tablet-small font-bold text-text">{`Step ${step} of 2`}</span> : null}
    </header>
  );
}
