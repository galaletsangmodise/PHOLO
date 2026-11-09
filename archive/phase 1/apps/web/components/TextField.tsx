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
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
  };

  let control;
  if (type === 'textarea') {
    control = (
      <textarea {...shared} rows={4} onChange={(event) => onChange(event.target.value)} className={fieldClasses(!!error)} />
    );
  } else if (type === 'password') {
    control = (
      <div className="relative">
        <input
          {...shared}
          type={revealed ? 'text' : 'password'}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClasses(!!error)} pr-s6`}
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
      <input {...shared} type={type} onChange={(event) => onChange(event.target.value)} className={fieldClasses(!!error)} />
    );
  }

  return (
    <div className="flex flex-col gap-s1">
      <label htmlFor={id} className="text-staff-body font-bold text-text">
        {label}
      </label>
      {control}
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}
