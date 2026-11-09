'use client';

import { formatAge, sastIsoDate, type VisitField, type VisitFormErrors, type VisitFormValues, OUTCOMES } from '@pholo/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Dropdown } from '@/components/Dropdown';
import { EmptyState } from '@/components/EmptyState';
import { FieldError } from '@/components/FieldError';
import { LoadingPlaceholder } from '@/components/LoadingPlaceholder';
import { MESSAGES } from '@/components/messages';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StaffHeader } from '@/components/StaffHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { TextField } from '@/components/TextField';
import { Toast } from '@/components/Toast';
import { focusRing } from '@/components/classes';
import { useOnlineStatus } from '@/components/useOnlineStatus';
import type { VisitDetail } from '@/components/visitsApi';

export type VisitState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; detail: VisitDetail };

interface VisitScreenProps {
  fullName: string;
  state: VisitState;
  values: VisitFormValues;
  errors: VisitFormErrors;
  /** The time the Visit was read, for the age (milliseconds). */
  nowMs: number;
  /** Forces the Offline state. Left out, the browser and API status decide. */
  offline?: boolean;
  /** Red text above the buttons (a server problem while saving). */
  formError?: string;
  /** The button that is working. */
  busy: 'draft' | 'complete' | null;
  /** There is typed text that "Save draft" has not saved: Log out asks first. */
  unsaved: boolean;
  /** M4 "Complete this visit?" or M4 "Leave without saving?". */
  dialog: 'complete' | 'leave' | null;
  dialogBusy?: boolean;
  dialogError?: boolean;
  toast?: string;
  onChange: (field: VisitField, value: string) => void;
  onSaveDraft: () => void;
  onComplete: () => void;
  onBack: () => void;
  onOpenFullFile: () => void;
  onTryAgain: () => void;
  onToastDone: () => void;
  onLogout: () => void;
  onConfirmDialog: () => void;
  onCancelDialog: () => void;
}

/** S9 Visit: the Patient strip and the form the clinician fills in (Clinical only). */
export function VisitScreen(props: VisitScreenProps) {
  const { fullName, state, values, errors, nowMs, formError, busy, unsaved, dialog, toast, onChange } = props;
  const online = useOnlineStatus();
  const isOffline = props.offline ?? !online;
  const today = sastIsoDate(new Date(nowMs));

  let content;
  if (state.kind === 'loading') {
    content = (
      <div className="flex flex-col gap-s3">
        <LoadingPlaceholder rows={2} />
        <LoadingPlaceholder rows={4} />
      </div>
    );
  } else if (state.kind === 'error') {
    content = <EmptyState icon="alert-circle" message={MESSAGES.serverProblem} actionLabel="Try again" onAction={props.onTryAgain} />;
  } else {
    const { visit, patient } = state.detail;
    const history = [
      ['Allergies', patient.allergies],
      ['Chronic conditions', patient.chronicConditions],
    ].filter(([, text]) => (text ?? '') !== '');
    content = (
      <div className="flex flex-col gap-s3">
        <Card className="flex flex-col gap-s1">
          <div className="flex flex-wrap items-center gap-s2">
            <h1 className="text-staff-title text-text">
              {`${patient.surname}, ${patient.firstName} · ${formatAge(patient.dateOfBirth, today)} · File ${patient.fileNumber} · Queue number ${visit.queueNumber}`}
            </h1>
            {visit.urgent ? <StatusBadge status="Urgent" /> : null}
          </div>
          <p className="text-staff-body text-textSecondary">{`Reason at Check-in: ${visit.reasonCategory}`}</p>
        </Card>

        {history.length > 0 ? (
          <section aria-label="From the paper file" className="flex flex-col gap-s1 rounded-card border border-borderLight bg-tint p-s2">
            <h2 className="text-staff-heading text-text">From the paper file</h2>
            {history.map(([label, text]) => (
              <p key={label} className="text-staff-body text-text">{`${label}: ${text}`}</p>
            ))}
          </section>
        ) : null}

        <form
          noValidate
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-s2"
        >
          <TextField label="Symptoms" type="textarea" value={values.symptoms} onChange={(value) => onChange('symptoms', value)} placeholder="What the patient told you, for example cough for 5 days" error={errors.symptoms} />
          <TextField label="Notes" type="textarea" value={values.notes} onChange={(value) => onChange('notes', value)} placeholder="Findings, treatment given, advice" error={errors.notes} />
          <TextField label="ICD-10 codes" value={values.icd10_codes} onChange={(value) => onChange('icd10_codes', value)} placeholder="For example J06.9, R50.9" error={errors.icd10_codes} />
          <Dropdown label="Outcome" options={OUTCOMES} value={values.outcome} onChange={(value) => onChange('outcome', value)} placeholder="Choose an outcome" error={errors.outcome} />
          {formError ? <FieldError message={formError} /> : null}
          <div className="flex flex-wrap gap-s2">
            <Button variant="secondary" disabled={isOffline || busy !== null} loading={busy === 'draft'} loadingLabel="Saving..." onClick={props.onSaveDraft}>
              Save draft
            </Button>
            <Button disabled={isOffline || busy !== null} loading={busy === 'complete'} onClick={props.onComplete}>
              Complete visit
            </Button>
          </div>
        </form>
        <div>
          <button type="button" onClick={props.onOpenFullFile} className={`min-h-touch text-staff-body font-bold text-primary underline ${focusRing}`}>
            Open full file
          </button>
        </div>
      </div>
    );
  }

  return (
    <main>
      <StaffHeader role="Clinical" fullName={fullName} activeLink="queue" unsavedChanges={unsaved} onLogout={props.onLogout} />
      <OfflineBanner message={MESSAGES.offlineStaff} offline={isOffline} />
      <div className="mx-auto flex max-w-content-staff flex-col gap-s2 p-s3">
        <button type="button" onClick={props.onBack} className={`self-start min-h-touch text-staff-body font-bold text-primary ${focusRing}`}>
          ← Back to queue
        </button>
        {content}
      </div>
      {dialog ? (
        <ConfirmDialog
          kind={dialog === 'complete' ? 'completeVisit' : 'leaveUnsaved'}
          loading={props.dialogBusy}
          error={props.dialogError}
          offline={isOffline}
          onConfirm={props.onConfirmDialog}
          onCancel={props.onCancelDialog}
        />
      ) : null}
      {toast ? <Toast message={toast} onDismiss={props.onToastDone} /> : null}
    </main>
  );
}
