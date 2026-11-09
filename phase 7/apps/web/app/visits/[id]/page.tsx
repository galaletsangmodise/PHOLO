'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { draftErrors, visitFormErrors, type VisitField, type VisitFormErrors, type VisitFormValues } from '@pholo/types';
import { ApiError } from '@/components/api';
import { setFlash } from '@/components/flash';
import { useSession } from '@/components/SessionProvider';
import { useGuardedApi } from '@/components/useGuardedApi';
import { useOnlineStatus } from '@/components/useOnlineStatus';
import { completeVisit, getVisit, saveDraft } from '@/components/visitsApi';
import { VisitScreen, type VisitState } from './VisitScreen';

const BLANK: VisitFormValues = { symptoms: '', notes: '', icd10_codes: '', outcome: '' };
const FIELDS: readonly VisitField[] = ['symptoms', 'notes', 'icd10_codes', 'outcome'];
const isField = (value: unknown): value is VisitField => FIELDS.includes(value as VisitField);
const same = (a: VisitFormValues, b: VisitFormValues): boolean => FIELDS.every((field) => a[field] === b[field]);

/** S9 wired to OP14 (open), OP15 (Save draft) and OP16 (Complete visit, through M4). Clinical only. */
export default function VisitPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { profile, logout } = useSession();
  const guarded = useGuardedApi();
  const online = useOnlineStatus();
  const allowed = profile?.role === 'Clinical';

  const [state, setState] = useState<VisitState>({ kind: 'loading' });
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [values, setValues] = useState<VisitFormValues>(BLANK);
  /** What the server holds: the draft that was loaded or last saved. Anything else typed is "unsaved". */
  const [saved, setSaved] = useState<VisitFormValues>(BLANK);
  const [errors, setErrors] = useState<VisitFormErrors>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [busy, setBusy] = useState<'draft' | 'complete' | null>(null);
  const [toast, setToast] = useState<string | undefined>();
  const [dialog, setDialog] = useState<{ kind: 'complete' } | { kind: 'leave'; target: string } | null>(null);
  const [dialogError, setDialogError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!allowed) return undefined;
    let cancelled = false;
    setState({ kind: 'loading' });
    guarded(() => getVisit(id))
      .then((detail) => {
        if (cancelled) return;
        // A Visit that is not In consultation has no S9: S6 for Waiting and Called, S8 for Completed and Left (Section 18, #23).
        if (detail.visit.status === 'Waiting' || detail.visit.status === 'Called') {
          router.replace('/queue');
          return;
        }
        if (detail.visit.status !== 'In consultation') {
          router.replace(`/patients/${detail.visit.patientId}`);
          return;
        }
        const draft: VisitFormValues = {
          symptoms: detail.visit.symptoms ?? '',
          notes: detail.visit.notes ?? '',
          icd10_codes: detail.visit.icd10Codes ?? '',
          outcome: detail.visit.outcome ?? '',
        };
        setValues(draft);
        setSaved(draft);
        setNowMs(Date.now());
        setState({ kind: 'ready', detail });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, id, attempt, guarded, router]);

  const unsaved = !same(values, saved);
  const change = useCallback((field: VisitField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError(undefined);
  }, []);

  if (!profile || profile.role !== 'Clinical') return null;

  const leave = (target: string) => (unsaved ? setDialog({ kind: 'leave', target }) : router.push(target));
  const patientPath = state.kind === 'ready' ? `/patients/${state.detail.visit.patientId}` : '';

  const saveTheDraft = async () => {
    const faults = draftErrors(values);
    setErrors(faults);
    if (Object.keys(faults).length > 0) return;
    setBusy('draft');
    setFormError(undefined);
    try {
      await guarded(() => saveDraft(id, values));
      setSaved(values);
      setToast('Draft saved.');
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setFormError(error instanceof ApiError ? error.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const askToComplete = () => {
    const faults = visitFormErrors(values);
    setErrors(faults);
    setFormError(undefined);
    if (Object.keys(faults).length === 0) {
      setDialogError(false);
      setDialog({ kind: 'complete' });
    }
  };

  const completeTheVisit = async () => {
    setBusy('complete');
    setDialogError(false);
    try {
      await guarded(() => completeVisit(id, values));
      setFlash('Visit completed.');
      router.push('/queue');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return;
      if (error instanceof ApiError && error.status === 400 && isField(error.data.field)) {
        setDialog(null);
        setErrors({ [error.data.field]: error.message });
      } else if (error instanceof ApiError && error.status === 409) {
        setDialog(null);
        setFormError(error.message);
      } else {
        setDialogError(true);
      }
    } finally {
      setBusy(null);
    }
  };

  const confirmDialog = () => {
    if (dialog?.kind === 'complete') void completeTheVisit();
    else if (dialog?.kind === 'leave') router.push(dialog.target);
  };

  return (
    <VisitScreen
      fullName={profile.fullName}
      state={state}
      values={values}
      errors={errors}
      nowMs={nowMs}
      offline={!online}
      formError={formError}
      busy={busy === 'complete' ? null : busy}
      unsaved={unsaved}
      dialog={dialog?.kind ?? null}
      dialogBusy={busy === 'complete'}
      dialogError={dialogError}
      toast={toast}
      onChange={change}
      onSaveDraft={() => void saveTheDraft()}
      onComplete={askToComplete}
      onBack={() => leave('/queue')}
      onOpenFullFile={() => leave(patientPath)}
      onTryAgain={() => setAttempt((count) => count + 1)}
      onToastDone={() => setToast(undefined)}
      onLogout={logout}
      onConfirmDialog={confirmDialog}
      onCancelDialog={() => setDialog(null)}
    />
  );
}
