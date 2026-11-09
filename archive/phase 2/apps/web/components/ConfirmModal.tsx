'use client';

import { useId } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { MESSAGES } from './messages';
import { OfflineBanner } from './OfflineBanner';

interface ConfirmModalProps {
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel: string;
  confirmVariant: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
  /** Loading: the confirm button reads "Please wait..." and is disabled. */
  loading?: boolean;
  /** Error (server problem): shows the server problem message. */
  error?: boolean;
  /** Offline: shows the banner and disables the confirm button. */
  offline?: boolean;
  /** Logging out of the Check-in Tablet still works offline (PRD 8.2, M4). */
  allowOfflineConfirm?: boolean;
}

/** M4 Confirm. The four versions (texts and buttons) are filled in Phase 3. */
export function ConfirmModal({
  title,
  text,
  confirmLabel,
  cancelLabel,
  confirmVariant,
  onConfirm,
  onCancel,
  loading = false,
  error = false,
  offline = false,
  allowOfflineConfirm = false,
}: ConfirmModalProps) {
  const titleId = useId();
  const confirmDisabled = offline && !allowOfflineConfirm;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-s3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-card bg-surface shadow-card"
      >
        {offline ? <OfflineBanner message={MESSAGES.offlineStaff} offline /> : null}
        <div className="flex flex-col gap-s2 p-s3">
          <h2 id={titleId} className="text-staff-heading text-text">
            {title}
          </h2>
          <p className="text-staff-body text-textSecondary">{text}</p>
          {error ? (
            <p role="alert" className="flex items-center gap-s1 text-staff-small text-error">
              <Icon name="alert-circle" size={16} />
              <span>{MESSAGES.serverProblem}</span>
            </p>
          ) : null}
          <div className="mt-s1 flex justify-between gap-s2">
            <Button variant="secondary" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={confirmVariant}
              loading={loading}
              loadingLabel="Please wait..."
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
