import { fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { CheckinProvider, type CheckinAnswers, type CheckinResult } from '@/components/CheckinProvider';

/** Sample content (1) to (3) of PRD 8.2 and 8.4. */
export const THANDI: Partial<CheckinAnswers> = {
  firstName: 'Thandi',
  surname: 'Dlamini',
  day: '14',
  month: '08',
  year: '1997',
  idNumber: '9708140234088',
  cellphone: '082 555 0147',
  hasFile: false,
};
export const JOSEPH: Partial<CheckinAnswers> = {
  firstName: 'Joseph',
  surname: 'Mokoena',
  day: '03',
  month: '05',
  year: '1954',
  idNumber: '5405035121082',
  cellphone: '',
  hasFile: true,
};
export const PALESA: Partial<CheckinAnswers> = {
  firstName: 'Palesa',
  surname: 'Molefe',
  day: '09',
  month: '01',
  year: '2025',
  idNumber: '',
  cellphone: '',
  hasFile: false,
};

export const NORMAL_RESULT: CheckinResult = { queueNumber: 14, alreadyCheckedIn: false, urgent: false, hasFile: false };

export function WithCheckin({
  children,
  answers,
  started = true,
  result = null,
}: {
  children: ReactNode;
  answers?: Partial<CheckinAnswers>;
  started?: boolean;
  result?: CheckinResult | null;
}) {
  return (
    <CheckinProvider initialAnswers={answers} initialStarted={started} initialResult={result}>
      {children}
    </CheckinProvider>
  );
}

export const typeInto = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

export function fillDetails(answers: Partial<CheckinAnswers>) {
  typeInto('First name', answers.firstName ?? '');
  typeInto('Surname', answers.surname ?? '');
  typeInto('Day', answers.day ?? '');
  typeInto('Month', answers.month ?? '');
  typeInto('Year', answers.year ?? '');
  typeInto(/ID number/, answers.idNumber ?? '');
  typeInto(/Cellphone number/, answers.cellphone ?? '');
  fireEvent.click(screen.getByRole('button', { name: answers.hasFile ? 'Yes, I have a file' : 'No, I do not have a file' }));
}
