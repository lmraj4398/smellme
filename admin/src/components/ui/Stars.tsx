import { cn } from '@/lib/utils';

/** A read-only 1–5 star rating. Announced to screen readers as "N out of 5". */
export function Stars({ rating, className }: { rating: number; className?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span role="img" aria-label={`${n} out of 5`} className={cn('tracking-[2px] text-antique', className)}>
      {'★'.repeat(n)}<span className="text-line">{'★'.repeat(5 - n)}</span>
    </span>
  );
}
