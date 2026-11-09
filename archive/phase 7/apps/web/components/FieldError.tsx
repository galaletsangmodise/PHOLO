import { Icon } from './Icon';

interface FieldErrorProps {
  id?: string;
  message: string;
  size?: 'staff' | 'tablet';
}

/** The error text under a field: a red message with an error icon (PRD 9.4). */
export function FieldError({ id, message, size = 'staff' }: FieldErrorProps) {
  const text = size === 'tablet' ? 'text-tablet-small' : 'text-staff-small';
  return (
    <p id={id} role="alert" className={`mt-s1 flex items-center gap-s1 ${text} text-error`}>
      <Icon name="alert-circle" size={size === 'tablet' ? 24 : 16} />
      <span>{message}</span>
    </p>
  );
}
