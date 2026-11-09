'use client';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';

interface EmptyStateProps {
  icon: IconName;
  message: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** An icon, a message, and a button when there is something to do. Centred in the list area. */
export function EmptyState({ icon, message, hint, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-s2 px-s3 py-s6 text-center">
      <span className="text-textSecondary">
        <Icon name={icon} size={48} />
      </span>
      <p className="text-staff-heading text-text">{message}</p>
      {hint ? <p className="text-staff-body text-textSecondary">{hint}</p> : null}
      {actionLabel ? (
        <Button variant="secondary" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
