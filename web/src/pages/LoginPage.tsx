import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { commerceApi } from '@/api/commerce';
import { Container } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiErrorMessage } from '@/lib/api-error';
import { normalizeIndianMobile, safeNext } from '@/lib/checkout';
import { useCustomerStore } from '@/store/customer.store';

export default function LoginPage() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const status = useCustomerStore((s) => s.status);
  const setSession = useCustomerStore((s) => s.setSession);

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The cooldown is a deadline, not a counter: a throttled background tab then can't make it run long.
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resendAt]);
  useEffect(() => { if (step === 'code') codeRef.current?.focus(); }, [step]);

  if (status === 'authed') return <Navigate to={next} replace />;
  const canonical = normalizeIndianMobile(phone);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!canonical) return setError('Enter a valid 10-digit mobile number');
    setError(null);
    setBusy(true);
    try {
      const r = await commerceApi.sendOtp(canonical);
      setStep('code');
      setCode('');
      setNow(Date.now());
      setResendAt(Date.now() + r.resend_after * 1000);
    } catch (err) {
      setError(apiErrorMessage(err, 'We couldn’t send the code. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(c: string) {
    if (!canonical || c.length !== 6 || busy) return;
    setError(null);
    setBusy(true);
    try {
      const s = await commerceApi.verifyOtp(canonical, c, name.trim() || undefined);
      setSession(s.customer, s.token);
      navigate(next, { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'That code didn’t work. Please try again.'));
      setCode('');
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="flex justify-center py-16 md:py-24">
      <div className="w-full max-w-md rounded-lg border border-line bg-white/60 p-8">
        <h1 className="font-serif text-[44px] leading-none">Sign in</h1>
        <p className="mt-3 text-taupe">We’ll send a code to your WhatsApp. No password needed.</p>

        {step === 'phone' ? (
          <form onSubmit={send} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="phone" className="label">Mobile number</label>
              <div className="flex rounded border border-field bg-white">
                <span className="flex items-center border-r border-line px-4 text-[15px]">+91</span>
                <input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit number" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} className="min-h-12 min-w-0 flex-1 bg-transparent px-4 text-[15px]" />
              </div>
            </div>
            {error && <p id="login-error" role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full min-h-[54px]">{busy ? 'Sending…' : 'Send code on WhatsApp'}</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); void verify(code); }} noValidate className="mt-6 space-y-4">
            <p className="text-[15px]">Enter the 6-digit code we sent to <strong>{canonical?.replace('+91', '+91 ')}</strong> on WhatsApp.</p>
            <div>
              <label htmlFor="code" className="label">Code</label>
              <input id="code" ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) void verify(v); }}
                aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined}
                className="field text-center font-serif text-3xl tracking-[0.4em]" />
            </div>
            <div>
              <label htmlFor="name" className="label">Your name <span className="font-normal text-taupe">(if you’re new)</span></label>
              <input id="name" autoComplete="name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className="field" />
            </div>
            {error && <p id="login-error" role="alert" className="text-sm text-danger">{error}</p>}
            <button type="submit" disabled={busy || code.length !== 6} className="btn-primary w-full min-h-[54px]">{busy ? 'Checking…' : 'Verify & continue'}</button>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <button type="button" className="min-h-11 underline" onClick={() => { setStep('phone'); setError(null); }}>Change number</button>
              <button type="button" className="min-h-11 underline disabled:no-underline disabled:opacity-60" disabled={resendIn > 0 || busy} onClick={() => void send()}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-[13px] leading-relaxed text-taupe">By continuing you agree to our <Link to="/help" className="underline">terms and privacy policy</Link>. Standard WhatsApp rules apply.</p>
      </div>
    </Container>
  );
}
