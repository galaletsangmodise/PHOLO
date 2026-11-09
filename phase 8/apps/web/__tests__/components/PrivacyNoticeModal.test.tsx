import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { PrivacyNoticeModal } from '@/components/PrivacyNoticeModal';

const SECTIONS: Array<[string, string]> = [
  ['What we collect', "Your name, date of birth, ID number and cellphone number (if you give them), why you came today, and the health information the nurse or doctor writes down during your visit."],
  ['Why', 'To put you in the queue, to keep your digital file and to give you care.'],
  ['Who can see it', "Only clinic staff who need it for their work. Reception staff cannot see the nurse's notes."],
  ['Where it is stored', 'On secure servers of our service provider, Supabase, in Europe. This is outside South Africa.'],
  ['How long we keep it', 'For 6 years after your last visit. For a child, until the child is 21 and the file has not been used for 6 years.'],
  ['Your rights', 'You may ask to see, correct or delete your information. Ask the clinic manager. Health records must be kept for the time the law requires.'],
];

describe('M1 Privacy Notice', () => {
  it('T-M1-1 shows the title, the six sections with the exact text and the "Close" button', () => {
    render(<PrivacyNoticeModal onClose={jest.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Privacy Notice' })).toBeTruthy();
    for (const [heading, text] of SECTIONS) {
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });

  it('T-M1-1 the text is 22 px on the Check-in Tablet', () => {
    render(<PrivacyNoticeModal onClose={jest.fn()} size="tablet" />);
    expect(screen.getByText(SECTIONS[1][1]).className).toContain('text-tablet-body');
  });

  it.each(['S1', 'S2', 'S3', 'S4'])('T-M1-2 opened from %s, "Close" shows that screen again', (screenName) => {
    function Opener() {
      const [open, setOpen] = useState(false);
      return (
        <div>
          <p>{`Screen ${screenName}`}</p>
          <button type="button" onClick={() => setOpen(true)}>Open notice</button>
          {open ? <PrivacyNoticeModal onClose={() => setOpen(false)} /> : null}
        </div>
      );
    }
    render(<Opener />);
    fireEvent.click(screen.getByRole('button', { name: 'Open notice' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(`Screen ${screenName}`)).toBeTruthy();
  });
});
