import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** The bordered, divided list every admin page uses for its rows. Children are `<li>`s. */
export function ListCard({ children, className }: { children: ReactNode; className?: string }) {
  return <ul className={cn('divide-y divide-line rounded-lg border border-line bg-white/60', className)}>{children}</ul>;
}
