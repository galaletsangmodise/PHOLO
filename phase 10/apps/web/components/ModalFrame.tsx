'use client';

import { useId, type ReactNode } from 'react';
import { MESSAGES } from './messages';
import { OfflineBanner } from './OfflineBanner';

interface ModalFrameProps {
  title: string;
  /** Shows the staff offline banner at the top of the modal. */
  offline: boolean;
  /** The Cancel and Save buttons. */
  actions: ReactNode;
  children: ReactNode;
}

/** The shell of the staff form modals (M2 and M3): dimmed backdrop, white card, offline banner, title, body and button row. */
export function ModalFrame({ title, offline, actions, children }: ModalFrameProps) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-s3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-card bg-surface shadow-card"
      >
        <OfflineBanner message={MESSAGES.offlineStaff} offline={offline} />
        <div className="flex flex-col gap-s2 overflow-y-auto p-s3">
          <h2 id={titleId} className="text-staff-title text-text">
            {title}
          </h2>
          {children}
        </div>
        <div className="flex justify-end gap-s2 border-t border-borderLight p-s3">{actions}</div>
      </div>
    </div>
  );
}
