import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { commerceApi, type Coupon } from '@/api/commerce.api';
import { Badge, Empty, PageHeader } from '@/components/ui/bits';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { apiErrorMessage } from '@/lib/api-error';
import { formatINR } from '@/lib/utils';
import { describeCoupon, emptyCoupon, fromCoupon, toCouponPayload, validateCoupon, type CouponForm } from './coupon-form';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { ListCard } from '@/components/ui/ListCard';

export default function CouponsPage() {
  const q = useQuery({ queryKey: ['coupons'], queryFn: commerceApi.coupons });
  const [edit, setEdit] = useState<Coupon | 'new' | null>(null);
  const now = Date.now();
  const state = (c: Coupon) =>
    !c.is_active ? <Badge tone="off">Off</Badge>
    : c.ends_at && new Date(c.ends_at).getTime() < now ? <Badge tone="off">Expired</Badge>
    : c.starts_at && new Date(c.starts_at).getTime() > now ? <Badge tone="warn">Scheduled</Badge>
    : c.max_uses !== null && c.used_count >= c.max_uses ? <Badge tone="warn">Fully used</Badge>
    : <Badge tone="ok">Live</Badge>;

  return (
    <div>
      <PageHeader title="Coupons" subtitle="Discount codes customers enter in their bag. A code can never be changed once made; switch it off and make a new one instead."
        actions={<button className="btn-primary" onClick={() => setEdit('new')}><Plus size={16} aria-hidden /> New coupon</button>} />
      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} />
      {q.data?.length === 0 && <Empty>No coupons yet.</Empty>}
      {!!q.data?.length && (
        <ListCard>
          {q.data.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-56">
                <div className="font-mono text-lg tracking-wide">{c.code} {state(c)}</div>
                <div className="text-sm text-taupe">{describeCoupon(c, formatINR)}{c.description ? ` · ${c.description}` : ''}</div>
              </div>
              <div className="text-sm text-taupe">Used {c.used_count}{c.max_uses !== null ? ` / ${c.max_uses}` : ''}</div>
              <button aria-label={`Edit ${c.code}`} className="flex h-11 w-11 items-center justify-center hover:text-antique" onClick={() => setEdit(c)}><Pencil size={18} /></button>
            </li>
          ))}
        </ListCard>
      )}
      {edit && <CouponModal item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CouponModal({ item, onClose }: { item: Coupon | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<CouponForm>(item ? fromCoupon(item) : emptyCoupon());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof CouponForm>(k: K, v: CouponForm[K]) => setF((x) => ({ ...x, [k]: v }));
  const save = useMutation({
    mutationFn: () => commerceApi.saveCoupon(item?.id ?? null, toCouponPayload(f)),
    onSuccess: () => { toast.success('Coupon saved'); void qc.invalidateQueries({ queryKey: ['coupons'] }); onClose(); },
  });

  return (
    <Modal title={item ? `Edit ${item.code}` : 'New coupon'} onClose={onClose} wide>
      <form noValidate onSubmit={(e) => { e.preventDefault(); const found = validateCoupon(f); setErrors(found); if (!Object.keys(found).length) save.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" error={errors.code} hint="Customers type this. Not case-sensitive."><input className="field font-mono uppercase" value={f.code} disabled={!!item} onChange={(e) => set('code', e.target.value)} /></Field>
          <Field label="Note for yourself"><input className="field" value={f.description} maxLength={120} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
        <div role="group" aria-label="Discount type" className="grid grid-cols-2 gap-2">
          {(['percent', 'flat'] as const).map((t) => (
            <button key={t} type="button" aria-pressed={f.type === t} onClick={() => set('type', t)} className={`min-h-11 rounded-full border ${f.type === t ? 'border-ink bg-ink text-ivory' : 'border-field bg-white'}`}>{t === 'percent' ? 'Percentage off' : 'Fixed amount off'}</button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={f.type === 'percent' ? 'Percent off' : 'Amount off (₹)'} error={errors.value}><input className="field" inputMode="decimal" value={f.value} onChange={(e) => set('value', e.target.value)} /></Field>
          <Field label="Minimum order (₹)" error={errors.min_order} hint="Optional"><input className="field" inputMode="decimal" value={f.min_order} onChange={(e) => set('min_order', e.target.value)} /></Field>
          {f.type === 'percent' && <Field label="Maximum discount (₹)" error={errors.max_discount} hint="Optional cap"><input className="field" inputMode="decimal" value={f.max_discount} onChange={(e) => set('max_discount', e.target.value)} /></Field>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" hint="Optional"><input type="datetime-local" className="field" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} /></Field>
          <Field label="Ends" error={errors.ends_at} hint="Optional"><input type="datetime-local" className="field" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)} /></Field>
          <Field label="Total uses allowed" error={errors.max_uses} hint="Empty = unlimited"><input className="field" inputMode="numeric" value={f.max_uses} onChange={(e) => set('max_uses', e.target.value)} /></Field>
          <Field label="Uses per customer" error={errors.per_customer_limit} hint="0 = unlimited"><input className="field" inputMode="numeric" value={f.per_customer_limit} onChange={(e) => set('per_customer_limit', e.target.value)} /></Field>
        </div>
        <Switch checked={f.is_active} onChange={(v) => set('is_active', v)} label="Coupon is switched on" />
        {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
        <div className="flex justify-end gap-3 pt-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save coupon'}</button></div>
      </form>
    </Modal>
  );
}
