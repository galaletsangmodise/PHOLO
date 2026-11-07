import { Icon } from './Icon';

/** A teal rounded square with a white plus, then "Pholo" in bold and "CMS" in regular (PRD 9.1). */
export function Logo() {
  return (
    <span data-testid="logo" className="inline-flex items-center gap-s1 text-primary">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 items-center justify-center rounded-card bg-primary text-white"
      >
        <Icon name="plus" size={28} />
      </span>
      <span className="text-staff-heading">
        <span className="font-bold">Pholo</span> <span className="font-normal">CMS</span>
      </span>
    </span>
  );
}
