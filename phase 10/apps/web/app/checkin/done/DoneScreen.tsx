'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { CheckinFrame } from '@/components/CheckinFrame';
import type { CheckinResult } from '@/components/CheckinProvider';
import { Icon } from '@/components/Icon';
import { useOnlineStatus } from '@/components/useOnlineStatus';
import { DONE_MS } from '../timers';

interface DoneScreenProps {
  facilityName: string;
  dateText: string;
  result: CheckinResult;
  offline?: boolean;
  /** Called when "Done" is tapped and when the 15 seconds are over. */
  onDone: () => void;
}

/** S5 You are checked in. It shows the Queue number only, never a name or a reason (BR10). */
export function DoneScreen({ facilityName, dateText, result, offline, onDone }: DoneScreenProps) {
  const online = useOnlineStatus();
  const latestOnDone = useRef(onDone);
  latestOnDone.current = onDone;
  useEffect(() => {
    const timer = setTimeout(() => latestOnDone.current(), DONE_MS);
    return () => clearTimeout(timer);
  }, []);

  const { alreadyCheckedIn } = result;
  return (
    <CheckinFrame facilityName={facilityName} dateTimeText={dateText} offline={offline ?? !online}>
      <div className="flex flex-col items-center gap-s3 text-center">
        <span data-testid="success-icon" className="text-success">
          <Icon name="check" size={64} />
        </span>
        <h1 className="text-tablet-title text-text">{alreadyCheckedIn ? 'You are already checked in.' : "You're checked in."}</h1>

        <Card className="w-full max-w-md">
          <p className="text-tablet-body text-textSecondary">Your number</p>
          <p data-testid="queue-number" className="text-tablet-queueNumber text-primary">
            {result.queueNumber}
          </p>
        </Card>

        <p className="text-tablet-body text-text">Please take a seat. We will call your number.</p>

        {!alreadyCheckedIn ? (
          <p className="text-tablet-body text-text">
            {result.hasFile
              ? 'Please keep your paper file with you and give it to the nurse.'
              : 'We have made a digital file for you. You do not need a paper file.'}
          </p>
        ) : null}

        {!alreadyCheckedIn && result.urgent ? (
          <Card tone="error" className="w-full max-w-xl">
            <p className="text-tablet-heading text-error">Please tell the Door Assistant or a nurse now. Your number is marked urgent.</p>
          </Card>
        ) : null}

        <Button size="tablet" onClick={onDone}>
          Done
        </Button>
        <p className="text-tablet-small text-textSecondary">This screen closes in 15 seconds.</p>
      </div>
    </CheckinFrame>
  );
}
