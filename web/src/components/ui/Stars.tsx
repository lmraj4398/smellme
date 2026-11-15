import { cn } from '@/lib/utils';

/** A read-only 1–5 star rating. The stars are decorative; screen readers get "N out of 5" via `label`. */
export function Stars({ rating, className, label = true }: { rating: number; className?: string; /** Announce "N out of 5" (turn off when the rating is already written out next to it). */ label?: boolean }) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <>
      <span aria-hidden className={cn('tracking-[2px] text-antique', className)}>{'★'.repeat(n)}<span className="text-line">{'★'.repeat(5 - n)}</span></span>
      {label && <span className="sr-only">{n} out of 5</span>}
    </>
  );
}
