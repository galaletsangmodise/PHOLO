'use client';

import Link from 'next/link';
import { Button } from './Button';
import { focusRing } from './classes';
import { Logo } from './Logo';

export type StaffRole = 'Reception' | 'Clinical' | 'Manager';
export type StaffLinkKey = 'queue' | 'patients' | 'summary';

interface StaffHeaderProps {
  role: StaffRole;
  fullName: string;
  activeLink?: StaffLinkKey;
  onLogout: () => void;
}

const LINKS: Record<StaffRole, Array<{ key: StaffLinkKey; label: string; href: string }>> = {
  Reception: [
    { key: 'queue', label: 'Queue', href: '/queue' },
    { key: 'patients', label: 'Find patient', href: '/patients' },
  ],
  Clinical: [
    { key: 'queue', label: 'Queue', href: '/queue' },
    { key: 'patients', label: 'Find patient', href: '/patients' },
  ],
  Manager: [{ key: 'summary', label: 'Summary', href: '/summary' }],
};

function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

/** The top menu on the staff screens (S6 to S10). Links depend on the role. */
export function StaffHeader({ role, fullName, activeLink, onLogout }: StaffHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-s2 border-b border-borderLight bg-surface px-s3 py-s1">
      <div className="flex items-center gap-s4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-s1">
          {LINKS[role].map((link) => {
            const active = link.key === activeLink;
            const underline = active ? 'border-primary' : 'border-transparent';
            return (
              <Link
                key={link.key}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex min-h-touch items-center border-b-focus px-s2 text-staff-body font-bold text-text ${underline} ${focusRing}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-s2">
        <span
          data-testid="initials"
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center rounded-badge bg-tint text-staff-body font-bold text-primary"
        >
          {initialsOf(fullName)}
        </span>
        <div className="flex flex-col">
          <span className="text-staff-small font-bold text-text">{fullName}</span>
          <span className="text-staff-small text-textSecondary">{role}</span>
        </div>
        <Button variant="secondary" onClick={onLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
