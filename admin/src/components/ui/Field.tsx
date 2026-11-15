import { useId, type ReactElement, type ReactNode, cloneElement } from 'react';

interface Props {
  label: string;
  error?: string;
  hint?: string;
  children: ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>;
  className?: string;
}

// Label + control + hint/error, wired together with ids so screen readers announce them.
export function Field({ label, error, hint, children, className }: Props) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      {cloneElement(children, { id, 'aria-invalid': !!error || undefined, 'aria-describedby': note ? `${id}-note` : undefined })}
      {note && <p id={`${id}-note`} role={error ? 'alert' : undefined} className={`mt-1 text-sm ${error ? 'text-danger' : 'text-taupe'}`}>{note}</p>}
    </div>
  );
}

export function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white/60 p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-2xl">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
