/** Shared Tailwind class groups, built only from design tokens. */

/** Keyboard focus look: a 3 px teal outline with a 2 px gap (PRD 9.3). */
export const focusRing =
  'focus-visible:outline focus-visible:outline-focus focus-visible:outline-offset-focus focus-visible:outline-primary';

/** Look shared by the Text field and the Dropdown (PRD 8.3). */
export function fieldClasses(hasError: boolean): string {
  const border = hasError ? 'border-error' : 'border-border';
  return [
    'w-full min-h-touch rounded-input border bg-surface px-s2 py-s1 text-staff-body text-text',
    'focus:outline focus:outline-focus focus:outline-offset-focus focus:outline-primary',
    border,
  ].join(' ');
}
