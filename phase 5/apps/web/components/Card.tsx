import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  /** "error" is the red card (for example the urgent card on S5). */
  tone?: 'default' | 'error';
}

const TONES = {
  default: 'border-borderLight bg-surface',
  error: 'border-error bg-errorBg',
} as const;

/** White, light border, soft shadow. The whole card is not clickable unless it holds a button or link. */
export function Card({ children, className = '', tone = 'default' }: CardProps) {
  return (
    <div data-testid="card" className={`rounded-card border p-s3 shadow-card ${TONES[tone]} ${className}`.trim()}>
      {children}
    </div>
  );
}
