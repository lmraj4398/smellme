import { useState } from 'react';
import { inboxApi } from '@/api/content';
import { apiErrorMessage } from '@/lib/api-error';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setState('sending');
    try {
      await inboxApi.subscribe({ email: email.trim(), ...(trap ? { website: trap } : {}) });
      setState('done');
    } catch (err) {
      setState('idle');
      setError(apiErrorMessage(err, 'Could not subscribe right now. Please try again.'));
    }
  }

  if (state === 'done') {
    return <p role="status" className="mt-2 font-serif text-2xl text-antique">Thank you — you’re on the list.</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex w-full max-w-[560px] flex-wrap justify-center gap-3">
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <input
        id="nl-email" type="email" autoComplete="email" placeholder="Your email address" value={email}
        onChange={(e) => setEmail(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? 'nl-error' : undefined}
        className="min-h-[54px] flex-[1_1_280px] rounded-full border border-field bg-white px-6 text-[15px]"
      />
      {/* Honeypot: invisible to people and assistive tech; bots fill it in. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} className="absolute -left-[9999px] h-0 w-0 opacity-0" />
      <button type="submit" disabled={state === 'sending'} className="btn-primary min-h-[54px] px-8">{state === 'sending' ? 'Subscribing…' : 'Subscribe'}</button>
      {error && <p id="nl-error" role="alert" className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
