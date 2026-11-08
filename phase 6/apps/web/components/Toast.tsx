'use client';

import { useEffect, useRef } from 'react';
import { tokens } from '@/styles/tokens';

interface ToastProps {
  message: string;
  /** Called after 3 seconds, so the screen can remove the toast. */
  onDismiss: () => void;
}

export function Toast({ message, onDismiss }: ToastProps) {
  const latestOnDismiss = useRef(onDismiss);
  latestOnDismiss.current = onDismiss;

  useEffect(() => {
    const timer = setTimeout(() => latestOnDismiss.current(), tokens.toast.durationMs);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      className="fixed bottom-s4 left-1/2 -translate-x-1/2 rounded-input bg-toastBg px-s3 py-s2 text-staff-body text-toastText"
    >
      {message}
    </div>
  );
}
