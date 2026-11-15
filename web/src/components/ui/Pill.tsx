import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * A pill-shaped toggle: filled when `active`, outlined otherwise. Styling only, so the caller sets the meaning
 * (`aria-pressed` for a filter chip, `role="tab"` + `aria-selected` for a tab). Pass `className` to adjust size.
 */
export function Pill({ active, className, type = 'button', ...props }: { active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn('min-h-11 shrink-0 rounded-full border px-5 text-sm', active ? 'border-ink bg-ink text-ivory' : 'border-field bg-white', className)}
      {...props}
    />
  );
}
