'use client';

import { useId } from 'react';
import { fieldClasses } from './classes';
import { FieldError } from './FieldError';

interface DateOfBirthFieldProps {
  day: string;
  month: string;
  year: string;
  onChange: (patch: { day?: string; month?: string; year?: string }) => void;
  error?: string;
  size?: 'staff' | 'tablet';
}

const digits = (value: string, max: number): string => value.replace(/\D/g, '').slice(0, max);

/** Three boxes: day, month, year. Reads as "DD / MM / YYYY" (PRD S3). */
export function DateOfBirthField({ day, month, year, onChange, error, size = 'tablet' }: DateOfBirthFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const text = size === 'tablet' ? 'text-tablet-body' : 'text-staff-body';
  const box = (label: string, placeholder: string, value: string, max: number, key: 'day' | 'month' | 'year', width: string) => (
    <div className={width}>
      <label htmlFor={`${id}-${key}`} className="sr-only">
        {label}
      </label>
      <input
        id={`${id}-${key}`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        maxLength={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange({ [key]: digits(event.target.value, max) })}
        className={`${fieldClasses(!!error, size)} text-center`}
      />
    </div>
  );

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-s1">
      <span id={`${id}-label`} className={`${text} font-bold text-text`}>
        Date of birth
      </span>
      <div className="flex items-center gap-s1">
        {box('Day', 'DD', day, 2, 'day', 'w-24')}
        <span aria-hidden="true" className={`${text} text-textSecondary`}>
          /
        </span>
        {box('Month', 'MM', month, 2, 'month', 'w-24')}
        <span aria-hidden="true" className={`${text} text-textSecondary`}>
          /
        </span>
        {box('Year', 'YYYY', year, 4, 'year', 'w-40')}
      </div>
      {error ? <FieldError id={errorId} message={error} size={size} /> : null}
    </div>
  );
}
