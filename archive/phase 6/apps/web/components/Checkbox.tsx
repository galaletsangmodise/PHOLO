'use client';

import type { ReactNode } from 'react';
import { FieldError } from './FieldError';
import { Icon } from './Icon';

interface CheckboxProps {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  size?: 'staff' | 'tablet';
}

/** A 32 px square box and a label. The real input is hidden but keeps keyboard and screen reader support. */
export function Checkbox({ label, checked, onChange, error, size = 'staff' }: CheckboxProps) {
  const boxLook = checked ? 'border-primary bg-primary text-white' : `bg-surface ${error ? 'border-error' : 'border-border'}`;
  return (
    <div className="flex flex-col gap-s1">
      <label className={`flex min-h-touch cursor-pointer items-center gap-s2 ${size === 'tablet' ? 'text-tablet-body' : 'text-staff-body'} text-text`}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          data-testid="checkbox-box"
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-input border-2 ${boxLook} peer-focus-visible:outline peer-focus-visible:outline-focus peer-focus-visible:outline-offset-focus peer-focus-visible:outline-primary`}
        >
          {checked ? <Icon name="check" size={24} /> : null}
        </span>
        <span>{label}</span>
      </label>
      {error ? <FieldError message={error} size={size} /> : null}
    </div>
  );
}
