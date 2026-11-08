'use client';

import { useId, useState } from 'react';
import { fieldClasses, focusRing } from './classes';
import { FieldError } from './FieldError';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** "textarea" is the long text variant; "password" adds a Show / Hide toggle. */
  type?: 'text' | 'email' | 'tel' | 'password' | 'textarea';
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
  autoComplete?: string;
  maxLength?: number;
  /** Staff screens are 16 px; the Check-in Tablet is 22 px with 72 px fields. */
  size?: 'staff' | 'tablet';
  inputMode?: 'text' | 'numeric' | 'tel';
}

export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  autoFocus,
  autoComplete,
  maxLength,
  size = 'staff',
  inputMode,
}: TextFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);

  const shared = {
    id,
    value,
    placeholder,
    autoFocus,
    autoComplete,
    maxLength,
    inputMode,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };

  let control;
  if (type === 'textarea') {
    control = (
      <textarea {...shared} rows={4} onChange={(event) => onChange(event.target.value)} className={fieldClasses(!!error, size)} />
    );
  } else if (type === 'password') {
    control = (
      <div className="relative">
        <input
          {...shared}
          type={revealed ? 'text' : 'password'}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClasses(!!error, size)} pr-s6`}
        />
        <button
          type="button"
          onClick={() => setRevealed((current) => !current)}
          className={`absolute inset-y-0 right-0 min-h-touch min-w-touch px-s2 text-staff-body font-bold text-primary ${focusRing}`}
        >
          {revealed ? 'Hide' : 'Show'}
        </button>
      </div>
    );
  } else {
    control = (
      <input {...shared} type={type} onChange={(event) => onChange(event.target.value)} className={fieldClasses(!!error, size)} />
    );
  }

  return (
    <div className="flex flex-col gap-s1">
      <label htmlFor={id} className={`${size === 'tablet' ? 'text-tablet-body' : 'text-staff-body'} font-bold text-text`}>
        {label}
      </label>
      {control}
      {error ? <FieldError id={errorId} message={error} size={size} /> : null}
    </div>
  );
}
