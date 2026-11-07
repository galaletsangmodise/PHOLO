import { Icon } from './Icon';

/** The error text under a field: a red message with an error icon (PRD 9.4). */
export function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-s1 flex items-center gap-s1 text-staff-small text-error">
      <Icon name="alert-circle" size={16} />
      <span>{message}</span>
    </p>
  );
}
