'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { focusRing } from './classes';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: ButtonVariant;
  /** 48 px on staff screens, 72 px on the Check-in Tablet. */
  size?: 'staff' | 'tablet';
  loading?: boolean;
  loadingLabel?: string;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:brightness-90 active:brightness-90',
  secondary: 'border-2 border-primary bg-surface text-primary hover:bg-tint',
  danger: 'bg-error text-white hover:brightness-90 active:brightness-90',
};

const SIZE_CLASSES = {
  staff: 'h-button-staff text-staff-body font-bold',
  tablet: 'h-button-tablet text-tablet-button',
} as const;

const DISABLED_CLASSES = 'cursor-not-allowed bg-disabledBg text-disabledText';

export function Button({
  variant = 'primary',
  size = 'staff',
  loading = false,
  loadingLabel,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const look = isDisabled ? DISABLED_CLASSES : VARIANT_CLASSES[variant];
  return (
    <button
      type={type}
      disabled={isDisabled}
      className={`inline-flex min-w-touch items-center justify-center gap-s1 rounded-button px-s3 ${SIZE_CLASSES[size]} ${look} ${focusRing} ${className}`.trim()}
      {...rest}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
