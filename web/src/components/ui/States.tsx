import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded bg-pearl', className)} />;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex min-h-[40vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-antique" />
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong while loading this.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="font-serif text-3xl">We couldn’t load this</p>
      <p className="text-taupe">{message}</p>
      {onRetry && <button className="btn-secondary" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('eyebrow', className)}>{children}</span>;
}

export const H2 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn('font-serif text-[clamp(36px,4vw,56px)] font-normal leading-[1.05]', className)}>{children}</h2>
);

/** The standard page column. */
export const Container = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('mx-auto max-w-[1360px] px-4 md:px-10', className)}>{children}</div>
);
