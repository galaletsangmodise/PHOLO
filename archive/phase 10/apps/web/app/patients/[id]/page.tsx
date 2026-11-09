'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { PAPER_HISTORY_MESSAGES, type PaperHistoryInput, type PatientInput } from '@pholo/types';
import { takeFlash } from '@/components/flash';
import { PatientDetailsModal } from '@/components/PatientDetailsModal';
import { PaperFileHistoryModal } from '@/components/PaperFileHistoryModal';
import { getPatientFile, recordPaperHistory, updatePatient } from '@/components/patientsApi';
import { useSession } from '@/components/SessionProvider';
import { useGuardedApi } from '@/components/useGuardedApi';
import { PatientFileScreen, type FileState } from './PatientFileScreen';

/** S8 Patient File wired to OP10 (open), OP12 (edit, through M2) and OP13 (paper file history, through M3). The file is opened, and logged, once per visit to the screen. */
export default function PatientFilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? '';
  const { profile, logout } = useSession();
  const guarded = useGuardedApi();
  const [state, setState] = useState<FileState>({ kind: 'loading' });
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const flashRead = useRef(false);

  useEffect(() => {
    if (flashRead.current) return;
    flashRead.current = true;
    setToast(takeFlash());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    guarded(() => getPatientFile(id))
      .then((file) => {
        if (!cancelled) setState({ kind: 'ready', ...file });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt, guarded]);

  if (!profile || (profile.role !== 'Reception' && profile.role !== 'Clinical')) return null;

  const save = async (body: PatientInput) => {
    const patient = await guarded(() => updatePatient(id, body));
    setState((current) => (current.kind === 'ready' ? { ...current, patient } : current));
    setEditing(false);
    setToast('Details saved.');
  };

  const saveHistory = async (body: PaperHistoryInput) => {
    const patient = await guarded(() => recordPaperHistory(id, body));
    setState((current) => (current.kind === 'ready' ? { ...current, patient } : current));
    setRecording(false);
    setToast(PAPER_HISTORY_MESSAGES.saved);
  };

  return (
    <>
      <PatientFileScreen
        role={profile.role}
        fullName={profile.fullName}
        state={state}
        toast={toast}
        onToastDone={() => setToast(undefined)}
        onBack={() => router.back()}
        onTryAgain={() => setAttempt((count) => count + 1)}
        onEdit={() => setEditing(true)}
        onRecordHistory={() => setRecording(true)}
        onLogout={logout}
      />
      {editing && state.kind === 'ready' ? (
        <PatientDetailsModal
          mode="edit"
          patient={state.patient}
          onSubmit={(body) => save(body)}
          onCancel={() => setEditing(false)}
          onOpenExisting={(otherId) => router.push(`/patients/${otherId}`)}
        />
      ) : null}
      {recording && state.kind === 'ready' ? (
        <PaperFileHistoryModal patient={state.patient} onSubmit={(body) => saveHistory(body)} onCancel={() => setRecording(false)} />
      ) : null}
    </>
  );
}
