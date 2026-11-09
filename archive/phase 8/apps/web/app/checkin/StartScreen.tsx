'use client';

import { Button } from '@/components/Button';
import { CheckinFrame } from '@/components/CheckinFrame';
import { focusRing } from '@/components/classes';
import { useOnlineStatus } from '@/components/useOnlineStatus';

interface StartScreenProps {
  facilityName: string;
  dateTimeText: string;
  /** Left out, the browser and API status decide. */
  offline?: boolean;
  onCheckIn: () => void;
  onCheckInWithHelp: () => void;
  onOpenPrivacy: () => void;
  onLogoLongPress: () => void;
}

/** S2 Check-in start. */
export function StartScreen({ facilityName, dateTimeText, offline, onCheckIn, onCheckInWithHelp, onOpenPrivacy, onLogoLongPress }: StartScreenProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  return (
    <CheckinFrame
      facilityName={facilityName}
      dateTimeText={dateTimeText}
      offline={isOffline}
      bannerTone="red"
      onLogoLongPress={onLogoLongPress}
    >
      <div className="flex flex-col items-center gap-s3 py-s6 text-center">
        <h1 className="text-tablet-title text-text">Welcome. Check in here.</h1>
        <p className="text-tablet-body text-textSecondary">It takes about 1 minute. You do not need a card.</p>
        <div className="mt-s3 flex w-full max-w-md flex-col gap-s2">
          <Button size="tablet" disabled={isOffline} onClick={onCheckIn}>
            Check in
          </Button>
          <Button size="tablet" variant="secondary" disabled={isOffline} onClick={onCheckInWithHelp}>
            Check in with help
          </Button>
        </div>
        <button
          type="button"
          onClick={onOpenPrivacy}
          className={`min-h-touch px-s2 text-tablet-small font-bold text-primary underline ${focusRing}`}
        >
          Privacy Notice
        </button>
      </div>
    </CheckinFrame>
  );
}
