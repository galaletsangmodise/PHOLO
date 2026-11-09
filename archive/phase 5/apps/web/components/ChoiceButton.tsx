'use client';

import type { ReactNode } from 'react';
import { focusRing } from './classes';
import { Icon } from './Icon';

interface ChoiceButtonProps {
  selected: boolean;
  onClick?: () => void;
  children: ReactNode;
  size?: 'staff' | 'tablet';
}

/** A large button for single-choice questions. Selected: teal fill, white text and a tick. */
export function ChoiceButton({ selected, onClick, children, size = 'staff' }: ChoiceButtonProps) {
  const look = selected ? 'bg-primary text-white' : 'bg-surface text-primary';
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex ${size === 'tablet' ? 'min-h-button-tablet text-tablet-button' : 'min-h-touch text-staff-body'} w-full items-center justify-between gap-s1 rounded-button border-2 border-primary px-s3 py-s2 text-left font-bold ${look} ${focusRing}`}
    >
      <span>{children}</span>
      {selected ? <Icon name="check" size={24} /> : null}
    </button>
  );
}
