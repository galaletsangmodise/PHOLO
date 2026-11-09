'use client';

import { ConfirmModal } from './ConfirmModal';

export type ConfirmKind = 'markLeft' | 'completeVisit' | 'leaveUnsaved' | 'logoutTablet';

interface ConfirmDialogProps {
  kind: ConfirmKind;
  /** Mark as left only: "Number 3: Thandi Dlamini will move to Done today. This cannot be undone." */
  queueNumber?: number;
  patientName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
}

/** M4 Confirm with its four versions (PRD 8.2, plan T-M4-1 to T-M4-5). */
export function ConfirmDialog({ kind, queueNumber, patientName, ...rest }: ConfirmDialogProps) {
  switch (kind) {
    case 'markLeft':
      return (
        <ConfirmModal
          title="Mark this patient as left?"
          text={`Number ${queueNumber}: ${patientName} will move to Done today. This cannot be undone.`}
          confirmLabel="Yes, mark as left"
          cancelLabel="Cancel"
          confirmVariant="danger"
          {...rest}
        />
      );
    case 'completeVisit':
      return (
        <ConfirmModal
          title="Complete this visit?"
          text="You cannot change it afterwards."
          confirmLabel="Yes, complete visit"
          cancelLabel="Cancel"
          confirmVariant="primary"
          {...rest}
        />
      );
    case 'leaveUnsaved':
      return (
        <ConfirmModal
          title="Leave without saving?"
          text={'Your changes will be lost. Tap “Save draft” first to keep them.'}
          confirmLabel="Leave without saving"
          cancelLabel="Stay here"
          confirmVariant="danger"
          {...rest}
        />
      );
    case 'logoutTablet':
      return (
        <ConfirmModal
          title="Log out of this tablet?"
          text="Staff only. The tablet will stop checking patients in."
          confirmLabel="Yes, log out"
          cancelLabel="Cancel"
          confirmVariant="danger"
          allowOfflineConfirm
          {...rest}
        />
      );
  }
}
