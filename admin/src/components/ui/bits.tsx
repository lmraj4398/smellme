import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'ok' | 'warn' | 'off'; children: ReactNode }) {
  const tones = {
    neutral: 'bg-pearl text-ink',
    ok: 'bg-ok/10 text-ok',
    warn: 'bg-[#B7791F]/15 text-[#7A4F0E]',
    off: 'bg-field/40 text-taupe',
  };
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-serif text-4xl leading-none">{title}</h1>
        {subtitle && <p className="mt-2 max-w-prose text-taupe">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-field px-4 py-12 text-center text-taupe">{children}</div>;
}

/** The illustrated bottle used on the storefront until real photos exist. */
export function Bottle({ tint, liquid, mono, size = 64 }: { tint: string; liquid: string; mono?: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-end justify-center overflow-hidden"
      style={{ width: size, height: size * 1.25, background: tint, borderRadius: `${size / 2}px ${size / 2}px 3px 3px`, paddingBottom: size * 0.14 }}
    >
      <span className="flex flex-col items-center" style={{ width: '46%' }}>
        <span style={{ width: '42%', height: size * 0.14, background: '#C8A96A', borderRadius: 2 }} />
        <span style={{ width: '100%', height: size * 0.34, background: liquid, borderRadius: size * 0.06, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.11, fontFamily: 'Georgia, serif' }}>
          {mono}
        </span>
      </span>
    </span>
  );
}
