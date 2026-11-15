import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PillTab<T extends string> { id: T; label: ReactNode }

/** A row of pill-shaped tabs that scrolls sideways when it does not fit. Used to switch a list's view or filter. */
export function PillTabs<T extends string>({ items, value, onChange, label, className }: {
  items: readonly PillTab<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Accessible name of the whole group. */
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn('mb-5 flex gap-2 overflow-x-auto', className)}>
      {items.map((t) => (
        <button
          key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cn('min-h-11 shrink-0 rounded-full border px-5 text-[15px]', value === t.id ? 'border-ink bg-ink text-ivory' : 'border-field bg-white')}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
