import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** White, light border, soft shadow. The whole card is not clickable unless it holds a button or link. */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      data-testid="card"
      className={`rounded-card border border-borderLight bg-surface p-s3 shadow-card ${className}`.trim()}
    >
      {children}
    </div>
  );
}
