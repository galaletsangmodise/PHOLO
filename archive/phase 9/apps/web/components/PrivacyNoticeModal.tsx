'use client';

import { useId } from 'react';
import { Button } from './Button';

/** The Privacy Notice text of PRD 8.2 (M1). */
const SECTIONS: ReadonlyArray<{ heading: string; text: string }> = [
  {
    heading: 'What we collect',
    text: 'Your name, date of birth, ID number and cellphone number (if you give them), why you came today, and the health information the nurse or doctor writes down during your visit.',
  },
  { heading: 'Why', text: 'To put you in the queue, to keep your digital file and to give you care.' },
  {
    heading: 'Who can see it',
    text: "Only clinic staff who need it for their work. Reception staff cannot see the nurse's notes.",
  },
  {
    heading: 'Where it is stored',
    text: 'On secure servers of our service provider, Supabase, in Europe. This is outside South Africa.',
  },
  {
    heading: 'How long we keep it',
    text: 'For 6 years after your last visit. For a child, until the child is 21 and the file has not been used for 6 years.',
  },
  {
    heading: 'Your rights',
    text: 'You may ask to see, correct or delete your information. Ask the clinic manager. Health records must be kept for the time the law requires.',
  },
];

interface PrivacyNoticeModalProps {
  onClose: () => void;
  /** 22 px text on the Check-in Tablet, 16 px on staff screens. */
  size?: 'staff' | 'tablet';
}

/** M1 Privacy Notice. "Close" returns to the screen that opened it (S1, S2, S3 or S4). */
export function PrivacyNoticeModal({ onClose, size = 'staff' }: PrivacyNoticeModalProps) {
  const titleId = useId();
  const body = size === 'tablet' ? 'text-tablet-body' : 'text-staff-body';
  const heading = size === 'tablet' ? 'text-tablet-heading' : 'text-staff-heading';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-backdrop p-s3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full max-w-content-tablet flex-col overflow-hidden rounded-card bg-surface shadow-card"
      >
        <div className="flex flex-col gap-s3 overflow-y-auto p-s3">
          <h2 id={titleId} className={`${size === 'tablet' ? 'text-tablet-title' : 'text-staff-title'} text-text`}>
            Privacy Notice
          </h2>
          {SECTIONS.map((section) => (
            <section key={section.heading} className="flex flex-col gap-s1">
              <h3 className={`${heading} text-text`}>{section.heading}</h3>
              <p className={`${body} text-textSecondary`}>{section.text}</p>
            </section>
          ))}
        </div>
        <div className="flex justify-end border-t border-borderLight p-s3">
          <Button size={size === 'tablet' ? 'tablet' : 'staff'} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
