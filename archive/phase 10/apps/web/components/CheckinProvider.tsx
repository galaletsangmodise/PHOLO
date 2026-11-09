'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ReasonCategory } from '@pholo/types';

/** Everything typed on S3 and S4. It lives in memory only: never in storage or the address (BR10). */
export interface CheckinAnswers {
  assisted: boolean;
  firstName: string;
  surname: string;
  day: string;
  month: string;
  year: string;
  idNumber: string;
  cellphone: string;
  hasFile: boolean | null;
  reason: ReasonCategory | null;
  urgent: boolean | null;
  consent: boolean;
}

/** What S5 shows: the Queue number and three flags, never a name or a reason (BR10). */
export interface CheckinResult {
  queueNumber: number;
  alreadyCheckedIn: boolean;
  urgent: boolean;
  hasFile: boolean;
}

export const EMPTY_ANSWERS: CheckinAnswers = {
  assisted: false,
  firstName: '',
  surname: '',
  day: '',
  month: '',
  year: '',
  idNumber: '',
  cellphone: '',
  hasFile: null,
  reason: null,
  urgent: null,
  consent: false,
};

interface CheckinValue {
  answers: CheckinAnswers;
  /** False after a reload or after the answers were erased: S3 to S5 then send the user to S2. */
  started: boolean;
  result: CheckinResult | null;
  start(assisted: boolean): void;
  update(patch: Partial<CheckinAnswers>): void;
  setResult(result: CheckinResult): void;
  /** Erases every answer and the result (S2, 2-minute timer, 15-second timer). */
  reset(): void;
}

const CheckinContext = createContext<CheckinValue | null>(null);

export function useCheckin(): CheckinValue {
  const value = useContext(CheckinContext);
  if (!value) throw new Error('useCheckin must be used inside a CheckinProvider.');
  return value;
}

interface CheckinProviderProps {
  children: ReactNode;
  /** For tests: answers and state to start from. */
  initialAnswers?: Partial<CheckinAnswers>;
  initialStarted?: boolean;
  initialResult?: CheckinResult | null;
}

export function CheckinProvider({ children, initialAnswers, initialStarted = false, initialResult = null }: CheckinProviderProps) {
  const [answers, setAnswers] = useState<CheckinAnswers>({ ...EMPTY_ANSWERS, ...initialAnswers });
  const [started, setStarted] = useState(initialStarted);
  const [result, setResultState] = useState<CheckinResult | null>(initialResult);

  const start = useCallback((assisted: boolean) => {
    setAnswers({ ...EMPTY_ANSWERS, assisted });
    setResultState(null);
    setStarted(true);
  }, []);
  const update = useCallback((patch: Partial<CheckinAnswers>) => setAnswers((current) => ({ ...current, ...patch })), []);
  const setResult = useCallback((next: CheckinResult) => setResultState(next), []);
  const reset = useCallback(() => {
    setAnswers(EMPTY_ANSWERS);
    setResultState(null);
    setStarted(false);
  }, []);

  const value = useMemo(
    () => ({ answers, started, result, start, update, setResult, reset }),
    [answers, started, result, start, update, setResult, reset],
  );
  return <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>;
}
