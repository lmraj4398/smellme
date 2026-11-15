import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { commerceApi, type PaymentSettings, type ShopSettings } from '@/api/commerce.api';
import { Card, Field } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/bits';
import { PageLoader } from '@/components/ui/PageLoader';
import { apiErrorMessage } from '@/lib/api-error';
import { paiseToRupees, rupeesToPaise } from '@/lib/money';
import { useAuthStore } from '@/store/auth.store';

const UPI = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}@[A-Za-z][A-Za-z0-9]{1,31}$/;

export default function SettingsPage() {
  const isOwner = useAuthStore((s) => s.user?.screens === null);
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Delivery, gift wrap and where customers pay." />
      <ShopCard />
      {isOwner ? <PaymentCard /> : (
        <Card title="Payment"><p className="text-taupe">The UPI address customers pay is managed by the owner only, so it can’t be changed by accident or by anyone else.</p></Card>
      )}
    </div>
  );
}

interface ShopForm { free_over: string; fee: string; wrap: string; samples: string; eta: string }

function ShopCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['shop-settings'], queryFn: commerceApi.shop });
  const [f, setF] = useState<ShopForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (q.data) setF({ free_over: paiseToRupees(q.data.free_delivery_over_paise), fee: paiseToRupees(q.data.delivery_fee_paise), wrap: paiseToRupees(q.data.gift_wrap_paise), samples: String(q.data.free_samples_count), eta: q.data.delivery_eta_text });
  }, [q.data]);

  const save = useMutation({
    mutationFn: (b: ShopSettings) => commerceApi.saveShop(b),
    onSuccess: (d) => { qc.setQueryData(['shop-settings'], d); toast.success('Saved. New prices apply to new bags straight away.'); },
  });
  if (q.isLoading || !f) return q.isError ? <Card title="Delivery & gift wrap"><p role="alert" className="text-danger">Could not load. <button className="underline" onClick={() => void q.refetch()}>Try again</button></p></Card> : <PageLoader />;
  const set = (k: keyof ShopForm, v: string) => setF({ ...f, [k]: v });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const free = rupeesToPaise(f!.free_over), fee = rupeesToPaise(f!.fee), wrap = rupeesToPaise(f!.wrap);
    const n = Number(f!.samples);
    const found: Record<string, string> = {};
    if (free === null) found.free_over = 'Enter an amount (0 = always free)';
    if (fee === null) found.fee = 'Enter an amount';
    if (wrap === null) found.wrap = 'Enter an amount';
    if (!Number.isInteger(n) || n < 0 || n > 5) found.samples = '0 to 5';
    if (f!.eta.length > 80) found.eta = 'Keep it under 80 characters';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate({ free_delivery_over_paise: free!, delivery_fee_paise: fee!, gift_wrap_paise: wrap!, free_samples_count: n, delivery_eta_text: f!.eta.trim() });
  }

  return (
    <Card title="Delivery & gift wrap">
      <form onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Free delivery on orders from (₹)" error={errors.free_over} hint="Judged on the items, before any coupon"><input className="field" inputMode="decimal" value={f.free_over} onChange={(e) => set('free_over', e.target.value)} /></Field>
          <Field label="Delivery charge below that (₹)" error={errors.fee}><input className="field" inputMode="decimal" value={f.fee} onChange={(e) => set('fee', e.target.value)} /></Field>
          <Field label="Gift wrap & note (₹)" error={errors.wrap}><input className="field" inputMode="decimal" value={f.wrap} onChange={(e) => set('wrap', e.target.value)} /></Field>
          <Field label="Free samples with every order" error={errors.samples} hint="0 turns the offer off"><input className="field" inputMode="numeric" value={f.samples} onChange={(e) => set('samples', e.target.value)} /></Field>
        </div>
        <Field label="Delivery time shown to customers" error={errors.eta}><input className="field" value={f.eta} onChange={(e) => set('eta', e.target.value)} /></Field>
        {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
        <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
      </form>
    </Card>
  );
}

function PaymentCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payment-settings'], queryFn: commerceApi.payment });
  const [vpa, setVpa] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (q.data) { setVpa(q.data.upi_vpa); setName(q.data.upi_payee_name); } }, [q.data]);
  const save = useMutation({
    mutationFn: (b: PaymentSettings) => commerceApi.savePayment(b),
    onSuccess: (d) => { qc.setQueryData(['payment-settings'], d); toast.success('Payment address saved. New orders will show it.'); },
  });
  if (q.isLoading) return <PageLoader />;
  const changed = q.data && (vpa.trim() !== q.data.upi_vpa || name.trim() !== q.data.upi_payee_name);

  return (
    <Card title="Payment (UPI)">
      <p className="mb-4 text-sm text-taupe">Customers scan a QR for this UPI address and pay the order amount. <strong>Double-check it: money goes here.</strong> Only owners can see or change it. Existing unpaid orders keep showing the new address too, so don’t change it while orders are awaiting payment unless you mean to.</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!UPI.test(vpa.trim())) return setErr('Enter a UPI address like yourshop@okhdfcbank');
        if (!name.trim()) return setErr('Enter the name customers should see');
        setErr(null);
        if (q.data?.upi_vpa && vpa.trim() !== q.data.upi_vpa && !confirm(`Change the payment address from ${q.data.upi_vpa} to ${vpa.trim()}?\n\nCustomers will pay this address from now on.`)) return;
        save.mutate({ upi_vpa: vpa.trim(), upi_payee_name: name.trim() });
      }} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="UPI address" error={err && err.includes('UPI') ? err : undefined}><input className="field" value={vpa} autoComplete="off" onChange={(e) => setVpa(e.target.value)} placeholder="yourshop@okhdfcbank" /></Field>
          <Field label="Name shown in the payment app" error={err && !err.includes('UPI') ? err : undefined}><input className="field" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></Field>
        </div>
        {!q.data?.upi_vpa && <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">No payment address is set. Customers can’t pay until you add one.</p>}
        {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
        <button type="submit" className="btn-primary" disabled={save.isPending || !changed}>{save.isPending ? 'Saving…' : 'Save payment address'}</button>
      </form>
    </Card>
  );
}
