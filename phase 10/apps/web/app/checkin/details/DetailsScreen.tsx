'use client';

import { useState } from 'react';
import { sastIsoDate } from '@pholo/types';
import { Button } from '@/components/Button';
import { CheckinFrame } from '@/components/CheckinFrame';
import { useCheckin, type CheckinAnswers } from '@/components/CheckinProvider';
import { validateDetails, type DetailsErrors } from '@/components/checkinRules';
import { ChoiceButton } from '@/components/ChoiceButton';
import { focusRing } from '@/components/classes';
import { DateOfBirthField } from '@/components/DateOfBirthField';
import { FieldError } from '@/components/FieldError';
import { TextField } from '@/components/TextField';
import { useOnlineStatus } from '@/components/useOnlineStatus';

interface DetailsScreenProps {
  facilityName: string;
  dateText: string;
  /** Today in SAST as "YYYY-MM-DD". Left out, it is worked out from the clock. */
  today?: string;
  offline?: boolean;
  onBack: () => void;
  onNext: () => void;
  onOpenPrivacy: () => void;
}

/** S3 Your details (step 1 of 2). */
export function DetailsScreen({ facilityName, dateText, today, offline, onBack, onNext, onOpenPrivacy }: DetailsScreenProps) {
  const { answers, update } = useCheckin();
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  const [errors, setErrors] = useState<DetailsErrors>({});

  /** Changing a field takes away its own message; the others stay until "Next" is tapped again. */
  const change = (patch: Partial<CheckinAnswers>, ...fields: Array<keyof DetailsErrors>) => {
    update(patch);
    if (fields.some((field) => errors[field])) {
      setErrors((current) => {
        const next = { ...current };
        fields.forEach((field) => delete next[field]);
        return next;
      });
    }
  };

  const goNext = () => {
    const found = validateDetails(answers, today ?? sastIsoDate(new Date()));
    setErrors(found);
    if (Object.keys(found).length === 0) onNext();
  };

  return (
    <CheckinFrame facilityName={facilityName} dateTimeText={dateText} step={1} offline={isOffline}>
      <h1 className="text-tablet-title text-text">Your details</h1>
      {answers.assisted ? (
        <p className="rounded-card bg-tint px-s3 py-s2 text-tablet-body text-text">The Door Assistant will help you.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-s3 landscape:grid-cols-2">
        <TextField
          size="tablet"
          label="First name"
          placeholder="For example Thandi"
          autoComplete="off"
          value={answers.firstName}
          onChange={(firstName) => change({ firstName }, 'firstName')}
          error={errors.firstName}
        />
        <TextField
          size="tablet"
          label="Surname"
          placeholder="For example Dlamini"
          autoComplete="off"
          value={answers.surname}
          onChange={(surname) => change({ surname }, 'surname')}
          error={errors.surname}
        />
        <DateOfBirthField
          day={answers.day}
          month={answers.month}
          year={answers.year}
          onChange={(patch) => change(patch, 'dateOfBirth', 'idNumber')}
          error={errors.dateOfBirth}
        />
        <TextField
          size="tablet"
          label="ID number (optional)"
          placeholder="13 digits, if you have one"
          inputMode="numeric"
          autoComplete="off"
          maxLength={13}
          value={answers.idNumber}
          onChange={(idNumber) => change({ idNumber: idNumber.replace(/\D/g, '') }, 'idNumber')}
          error={errors.idNumber}
        />
        <TextField
          size="tablet"
          label="Cellphone number (optional)"
          placeholder="For example 082 555 0147"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          value={answers.cellphone}
          onChange={(cellphone) => change({ cellphone }, 'cellphone')}
          error={errors.cellphone}
        />
      </div>

      <div role="group" aria-labelledby="file-question" className="flex flex-col gap-s1">
        <p id="file-question" className="text-tablet-body font-bold text-text">
          Do you have a file at this clinic?
        </p>
        <div className="grid grid-cols-1 gap-s2 landscape:grid-cols-2">
          <ChoiceButton size="tablet" selected={answers.hasFile === true} onClick={() => change({ hasFile: true }, 'hasFile')}>
            Yes, I have a file
          </ChoiceButton>
          <ChoiceButton size="tablet" selected={answers.hasFile === false} onClick={() => change({ hasFile: false }, 'hasFile')}>
            No, I do not have a file
          </ChoiceButton>
        </div>
        {errors.hasFile ? <FieldError message={errors.hasFile} size="tablet" /> : null}
      </div>

      <div className="flex items-center justify-between gap-s3">
        <Button size="tablet" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <button
          type="button"
          onClick={onOpenPrivacy}
          className={`min-h-touch px-s2 text-tablet-small font-bold text-primary underline ${focusRing}`}
        >
          Privacy Notice
        </button>
        <Button size="tablet" disabled={isOffline} onClick={goNext}>
          Next
        </Button>
      </div>
    </CheckinFrame>
  );
}
