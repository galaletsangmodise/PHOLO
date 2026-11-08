interface LoadingPlaceholderProps {
  /** How many grey blocks to show: the shape of the real content. */
  rows?: number;
  className?: string;
}

/** Grey blocks with a soft pulse. Never a spinner on its own. */
export function LoadingPlaceholder({ rows = 3, className = '' }: LoadingPlaceholderProps) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className={`flex flex-col gap-s2 ${className}`.trim()}>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          data-testid="placeholder-block"
          className="h-s6 w-full animate-pulse rounded-card bg-skeleton"
        />
      ))}
    </div>
  );
}
