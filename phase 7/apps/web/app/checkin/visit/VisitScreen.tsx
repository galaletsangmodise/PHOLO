'use client';

import { useState } from 'react';
import { REASON_CATEGORIES, sastIsoDate } from '@pholo/types';
import { Button } from '@/components/Button';
import { CheckinFrame } from '@/components/CheckinFrame';
import { useCheckin } from '@/components/CheckinProvider';
import { ageOn, dateOfBirthIso, validateVisit, type VisitErrors } from '@/components/checkinRules';
import { Checkbox } from '@/components/Checkbox';
import { ChoiceButton } from '@/components/ChoiceButton';
import { focusRing } from '@/components/classes';
import { FieldError } from '@/components/FieldError';
import { MESSAGES } from '@/components/messages';
import { useOnlineStatus } from '@/components/useOnlineStatus';

interface VisitScreenProps {
  facilityName: string;
  dateText: string;
  today?: string;
  offline?: boolean;
  /** The button reads "Checking you in..." and is disabled. */
  loading?: boolean;
  /** A message from the server. The server problem message turns the button into "Try again". */
  error?: string;
  onBack: () => void;
  onSubmit: () => void;
  onOpenPrivacy: () => void;
}

/** S4 Why are you here today? (step 2 of 2). */
export function VisitScreen({ facilityName, dateText, today, offline, loading = false, error, onBack, onSubmit, onOpenPrivacy }: VisitScreenProps) {
  const { answers, update } = useCheckin();
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  const [errors, setErrors] = useState<VisitErrors>({});
  const day = today ?? sastIsoDate(new Date());

  const dateOfBirth = dateOfBirthIso(answers);
  const underEighteen = dateOfBirth !== null && ageOn(dateOfBirth, day) < 18;

  const change = (patch: Parameters<typeof update>[0], field: keyof VisitErrors) => {
    update(patch);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = () => {
    const found = validateVisit(answers);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit();
  };

  const buttonLabel = error === MESSAGES.serverProblem ? 'Try again' : 'Check in';

  return (
    <CheckinFrame facilityName={facilityName} dateTimeText={dateText} step={2} offline={isOffline}>
      <section data-testid="reason-section" className="flex flex-col gap-s2">
        <h1 className="text-tablet-title text-text">Why are you here today?</h1>
        <div className="grid grid-cols-1 gap-s2 landscape:grid-cols-2">
          {REASON_CATEGORIES.map((reason) => (
            <ChoiceButton key={reason} size="tablet" selected={answers.reason === reason} onClick={() => change({ reason }, 'reason')}>
              {reason}
            </ChoiceButton>
          ))}
        </div>
        {errors.reason ? <FieldError message={errors.reason} size="tablet" /> : null}
      </section>

      <section data-testid="urgent-section" className="flex flex-col gap-s2">
        <h2 className="text-tablet-heading text-text">Do you have any of these right now?</h2>
        <p className="text-tablet-body text-textSecondary">Trouble breathing, chest pain, heavy bleeding, fainting, a seizure, or a very sick baby.</p>
        <div className="grid grid-cols-2 gap-s2">
          <ChoiceButton size="tablet" selected={answers.urgent === true} onClick={() => change({ urgent: true }, 'urgent')}>
            Yes
          </ChoiceButton>
          <ChoiceButton size="tablet" selected={answers.urgent === false} onClick={() => change({ urgent: false }, 'urgent')}>
            No
          </ChoiceButton>
        </div>
        {errors.urgent ? <FieldError message={errors.urgent} size="tablet" /> : null}
      </section>

      <section data-testid="consent-section" className="flex flex-col gap-s1">
        {underEighteen ? (
          <p className="text-tablet-body font-bold text-text">The patient is under 18, so a parent or guardian must tick this box.</p>
        ) : null}
        <Checkbox
          size="tablet"
          label="I agree to the Privacy Notice"
          checked={answers.consent}
          onChange={(consent) => change({ consent }, 'consent')}
          error={errors.consent}
        />
        <button
          type="button"
          onClick={onOpenPrivacy}
          className={`min-h-touch self-start px-s2 text-tablet-small font-bold text-primary underline ${focusRing}`}
        >
          Read the Privacy Notice
        </button>
      </section>

      {error ? <FieldError message={error} size="tablet" /> : null}

      <div className="flex items-center justify-between gap-s3">
        <Button size="tablet" variant="secondary" disabled={loading} onClick={onBack}>
          Back
        </Button>
        <Button size="tablet" loading={loading} loadingLabel="Checking you in..." disabled={isOffline} onClick={submit}>
          {buttonLabel}
        </Button>
      </div>
    </CheckinFrame>
  );
}
