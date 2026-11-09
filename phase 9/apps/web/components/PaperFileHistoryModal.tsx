'use client';

import { useState } from 'react';
import { PAPER_HISTORY_FIELD_ORDER, paperHistoryErrors, type PaperHistoryErrors, type PaperHistoryField, type PaperHistoryInput } from '@pholo/types';
import { ApiError } from './api';
import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { FieldError } from './FieldError';
import { MESSAGES } from './messages';
import { ModalFrame } from './ModalFrame';
import type { PatientRecord } from './patientsApi';
import { TextField } from './TextField';
import { useOnlineStatus } from './useOnlineStatus';

interface PaperFileHistoryModalProps {
  /** The Patient: the stored history fills the fields, and the status decides whether the checkbox shows. */
  patient: PatientRecord;
  /** Saves the history. A refusal comes back as an ApiError; success lets the parent close the modal. */
  onSubmit: (body: PaperHistoryInput) => Promise<void>;
  onCancel: () => void;
  /** Forces the Offline state. Left out, the browser's online status decides. */
  offline?: boolean;
}

const orNull = (value: string): string | null => (value.trim() === '' ? null : value.trim());

/** M3 Paper file history: type the history from the paper file and, when it is still "not yet digitised", mark the paper file as digitised (BR18). */
export function PaperFileHistoryModal({ patient, onSubmit, onCancel, offline }: PaperFileHistoryModalProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  const canMark = patient.paperFileStatus === 'Paper file - not yet digitised';

  const [chronic, setChronic] = useState(patient.chronicConditions ?? '');
  const [allergies, setAllergies] = useState(patient.allergies ?? '');
  const [medication, setMedication] = useState(patient.currentMedication ?? '');
  const [mark, setMark] = useState(false);

  const [errors, setErrors] = useState<PaperHistoryErrors>({});
  const [serverError, setServerError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const markDigitised = canMark && mark;
    const found = paperHistoryErrors({ chronic_conditions: chronic, allergies, current_medication: medication, mark_digitised: markDigitised });
    setErrors(found);
    setServerError(undefined);
    if (PAPER_HISTORY_FIELD_ORDER.some((field) => found[field])) return;

    setSaving(true);
    try {
      await onSubmit({ chronic_conditions: orNull(chronic), allergies: orNull(allergies), current_medication: orNull(medication), mark_digitised: markDigitised });
    } catch (caught) {
      setSaving(false);
      if (!(caught instanceof ApiError)) {
        setServerError(MESSAGES.serverProblem);
      } else if (caught.status === 400 && PAPER_HISTORY_FIELD_ORDER.includes(caught.data.field as PaperHistoryField)) {
        setErrors({ [caught.data.field as PaperHistoryField]: caught.message });
      } else if (caught.status !== 0) {
        setServerError(caught.message); // offline (status 0) is shown by the banner instead
      }
    }
  };

  return (
    <ModalFrame
      title="Paper file history"
      offline={isOffline}
      actions={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={save} disabled={isOffline} loading={saving} loadingLabel="Saving...">
            Save
          </Button>
        </>
      }
    >
      <TextField label="Chronic conditions" type="textarea" value={chronic} onChange={setChronic} placeholder="For example Hypertension" error={errors.chronic_conditions} />
      <TextField label="Allergies" type="textarea" value={allergies} onChange={setAllergies} placeholder="For example Penicillin" error={errors.allergies} />
      <TextField label="Current medication" type="textarea" value={medication} onChange={setMedication} placeholder="For example Amlodipine 5 mg once a day" error={errors.current_medication} />
      {canMark ? <Checkbox label="Mark the paper file as digitised" checked={mark} onChange={setMark} error={errors.mark_digitised} /> : null}
      {serverError ? <FieldError message={serverError} /> : null}
    </ModalFrame>
  );
}
