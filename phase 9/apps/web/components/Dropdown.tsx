'use client';

import { useId } from 'react';
import { fieldClasses } from './classes';
import { FieldError } from './FieldError';
import { Icon } from './Icon';

interface DropdownProps {
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}

export function Dropdown({ label, options, value, onChange, placeholder, error }: DropdownProps) {
  const id = useId();
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-s1">
      <label htmlFor={id} className="text-staff-body font-bold text-text">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${fieldClasses(!!error)} appearance-none pr-s6`}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-s2 flex items-center text-text">
          <Icon name="chevron-down" size={20} />
        </span>
      </div>
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}
