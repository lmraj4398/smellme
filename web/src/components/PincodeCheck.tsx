import { useId, useState } from 'react';
import { commerceApi } from '@/api/commerce';

type Result = { kind: 'ok'; eta: string } | { kind: 'no' } | { kind: 'error' };

/** "Check delivery to your pincode" box on the product page. */
export function PincodeCheck() {
  const id = useId();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const valid = /^[1-9]\d{5}$/.test(pin);

  async function check(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    try {
      const r = await commerceApi.checkPincode(pin);
      setResult(r.serviceable ? { kind: 'ok', eta: r.eta_text } : { kind: 'no' });
    } catch {
      setResult({ kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={check} className="flex flex-col gap-3 rounded bg-pearl px-5 py-[18px]">
      <label htmlFor={id} className="text-sm font-medium">Check delivery to your pincode</label>
      <div className="flex flex-wrap gap-2.5">
        <input
          id={id} inputMode="numeric" autoComplete="postal-code" maxLength={6} placeholder="6-digit pincode" value={pin}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setResult(null); }}
          className="min-h-[46px] flex-[1_1_160px] rounded border border-field bg-white px-4 text-[15px]"
        />
        <button type="submit" disabled={!valid || busy} className="min-h-[46px] rounded border border-ink px-[22px] text-[13px] uppercase tracking-[0.14em] disabled:opacity-40">
          {busy ? 'Checking…' : 'Check'}
        </button>
      </div>
      <div aria-live="polite" className="text-[13px] text-[#4A4238]">
        {result?.kind === 'ok' && <span>✓ We deliver to {pin}{result.eta ? ` — ${result.eta}` : ''}</span>}
        {result?.kind === 'no' && <span>Sorry, we can’t deliver to {pin} yet.</span>}
        {result?.kind === 'error' && <span>We couldn’t check that just now. Please try again.</span>}
      </div>
    </form>
  );
}
