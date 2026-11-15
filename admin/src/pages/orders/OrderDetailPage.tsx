import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Copy, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { ordersApi, type OrderDetail } from '@/api/orders.api';
import { Badge, PageHeader } from '@/components/ui/bits';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/PageLoader';
import { apiErrorMessage } from '@/lib/api-error';
import { formatINR } from '@/lib/utils';
import { approveBody, availableActions, canApprove, paymentWarnings, STATUS_LABEL, STATUS_TONE, type Warning } from './order-actions';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
type Dialog = 'reject' | 'ship' | 'cancel' | 'refund' | null;

export default function OrderDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [ticked, setTicked] = useState<Set<Warning['id']>>(new Set());

  const q = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.detail(id) });
  const done = (msg: string) => (o: OrderDetail) => {
    qc.setQueryData(['order', id], o);
    void qc.invalidateQueries({ queryKey: ['orders'] });
    void qc.invalidateQueries({ queryKey: ['orders-summary'] });
    setDialog(null);
    setTicked(new Set());
    toast.success(msg);
  };
  const fail = (e: unknown) => toast.error(apiErrorMessage(e));

  const approve = useMutation({ mutationFn: (b: Parameters<typeof ordersApi.approve>[1]) => ordersApi.approve(id, b), onSuccess: done('Payment approved. The customer has been told.'), onError: fail });
  const pack = useMutation({ mutationFn: () => ordersApi.pack(id), onSuccess: done('Marked as packed'), onError: fail });
  const deliver = useMutation({ mutationFn: () => ordersApi.deliver(id), onSuccess: done('Marked as delivered'), onError: fail });

  if (q.isLoading) return <PageLoader />;
  if (q.isError || !q.data) return <p className="py-12 text-center text-taupe">Could not load this order. <Link to="/orders" className="underline">Back to orders</Link></p>;
  const o = q.data;
  const actions = availableActions(o);
  const warnings = paymentWarnings(o.payment, formatINR);
  const busy = approve.isPending || pack.isPending || deliver.isPending;

  return (
    <div className="space-y-6 pb-12">
      <Link to="/orders" className="inline-flex min-h-11 items-center gap-1 text-sm text-taupe hover:text-ink"><ArrowLeft size={16} aria-hidden /> Orders</Link>
      <PageHeader title={o.order_no} subtitle={`Placed ${when(o.created_at)}`} actions={<Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>} />

      {/* Verify payment */}
      {(o.status === 'PAYMENT_SUBMITTED' || o.payment.has_receipt) && (
        <section aria-label="Payment" className="rounded-lg border border-line bg-white/60 p-4 md:p-6">
          <h2 className="mb-3 font-serif text-2xl">Payment</h2>
          <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-3">
            <div><dt className="text-sm text-taupe">Amount to receive</dt><dd className="font-serif text-3xl">{formatINR(o.payment.expected_amount_paise)}</dd></div>
            <div><dt className="text-sm text-taupe">Customer says they paid</dt><dd className="text-lg">{o.payment.claimed_amount_paise !== null ? formatINR(o.payment.claimed_amount_paise) : '—'}</dd></div>
            <div><dt className="text-sm text-taupe">Payment reference (UTR)</dt><dd className="break-all text-lg">{o.payment.utr ?? '—'}</dd></div>
          </dl>
          <p className="mt-2 text-sm text-taupe">Check your bank / UPI app for this exact amount before approving. Submitted {when(o.payment.submitted_at)}.</p>

          {o.payment.has_receipt && <ReceiptViewer orderId={o.id} />}

          {o.status === 'PAYMENT_SUBMITTED' && warnings.length > 0 && (
            <div role="alert" className="mt-4 space-y-2 rounded border border-danger/40 bg-danger/5 p-3">
              <p className="font-medium text-danger">Check before approving</p>
              {warnings.map((w) => (
                <label key={w.id} className="flex min-h-11 items-start gap-3 text-[15px]">
                  <input type="checkbox" className="mt-1" checked={ticked.has(w.id)} onChange={(e) => setTicked((s) => { const n = new Set(s); if (e.target.checked) n.add(w.id); else n.delete(w.id); return n; })} />
                  <span>{w.text} <strong>I have checked and want to approve anyway.</strong></span>
                </label>
              ))}
            </div>
          )}
          {o.payment.reject_reason && o.status === 'PENDING_PAYMENT' && <p className="mt-3 text-sm text-danger">Last rejected: {o.payment.reject_reason}</p>}
        </section>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {actions.includes('approve') && <button className="btn-primary" disabled={busy || !canApprove(warnings, ticked)} onClick={() => approve.mutate(approveBody(warnings, ticked))}>{approve.isPending ? 'Approving…' : 'Approve payment'}</button>}
          {actions.includes('reject') && <button className="btn-secondary" disabled={busy} onClick={() => setDialog('reject')}>Reject payment</button>}
          {actions.includes('pack') && <button className="btn-primary" disabled={busy} onClick={() => pack.mutate()}>Mark as packed</button>}
          {actions.includes('ship') && <button className="btn-primary" disabled={busy} onClick={() => setDialog('ship')}>Mark as shipped</button>}
          {actions.includes('deliver') && <button className="btn-primary" disabled={busy} onClick={() => deliver.mutate()}>Mark as delivered</button>}
          {actions.includes('refund') && <button className="btn-primary" disabled={busy} onClick={() => setDialog('refund')}>Record refund</button>}
          {actions.includes('cancel') && <button className="btn-secondary !border-danger !text-danger" disabled={busy} onClick={() => setDialog('cancel')}>Cancel order</button>}
        </div>
      )}
      {o.status === 'CANCELLED' && (
        <p className="rounded bg-pearl p-3 text-[15px]">
          Cancelled by {o.cancel.by} — “{o.cancel.reason}”. Stock has been returned.
          {o.cancel.refund_due && <strong className="ml-1 text-danger">A refund of {formatINR(o.totals.total_paise)} is still due to the customer.</strong>}
        </p>
      )}
      {o.status === 'REFUNDED' && <p className="rounded bg-pearl p-3 text-[15px]">Refunded {when(o.cancel.refunded_at)} — {o.cancel.refund_note}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="Items" className="rounded-lg border border-line bg-white/60 p-4 md:p-6">
          <h2 className="mb-3 font-serif text-2xl">Items</h2>
          <ul className="divide-y divide-line">
            {o.items.map((i, k) => (
              <li key={k} className="flex flex-wrap justify-between gap-2 py-3">
                <div><div className="font-medium">{i.name} <span className="font-normal text-taupe">· {i.label}</span></div><div className="text-sm text-taupe">{i.brand} · {i.sku}{i.is_free_sample && ' · free sample'}</div></div>
                <div className="text-right"><div>{i.qty} × {formatINR(i.unit_price_paise)}</div><div className="text-sm text-taupe">{formatINR(i.line_total_paise)}</div></div>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[15px]">
            <Row k="Subtotal" v={formatINR(o.totals.subtotal_paise)} />
            {o.totals.discount_paise > 0 && <Row k={`Discount${o.coupon_code ? ` (${o.coupon_code})` : ''}`} v={`− ${formatINR(o.totals.discount_paise)}`} />}
            <Row k="Delivery" v={o.totals.delivery_fee_paise ? formatINR(o.totals.delivery_fee_paise) : 'Free'} />
            {o.totals.gift_wrap_paise > 0 && <Row k="Gift wrap" v={formatINR(o.totals.gift_wrap_paise)} />}
            <div className="flex justify-between border-t border-ink pt-2 text-lg font-medium"><dt>Total</dt><dd>{formatINR(o.totals.total_paise)}</dd></div>
          </dl>
          {(o.gift.wrap || o.gift.message || o.gift.engraving) && (
            <div className="mt-4 rounded bg-pearl p-3 text-[15px]">
              <p className="font-medium">Gift instructions</p>
              {o.gift.wrap && <p>Gift wrap: yes</p>}
              {o.gift.engraving && <p>Engraving: <strong>{o.gift.engraving}</strong></p>}
              {/* Customer text: shown as plain text, never as HTML. */}
              {o.gift.message && <p className="whitespace-pre-wrap break-words">Note: {o.gift.message}</p>}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section aria-label="Delivery" className="rounded-lg border border-line bg-white/60 p-4 md:p-6">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-serif text-2xl">Deliver to</h2>
              <button className="flex min-h-11 items-center gap-1 text-sm underline" onClick={() => { void navigator.clipboard.writeText([o.address.name, o.address.phone, o.address.line1, o.address.line2, `${o.address.city}, ${o.address.state} ${o.address.pincode}`].filter(Boolean).join('\n')); toast.success('Address copied'); }}><Copy size={14} aria-hidden /> Copy</button></div>
            <address className="not-italic leading-relaxed">{o.address.name}<br />{o.address.phone}<br />{o.address.line1}{o.address.line2 && <><br />{o.address.line2}</>}<br />{o.address.city}, {o.address.state} {o.address.pincode}</address>
            {o.shipping.tracking_no && <p className="mt-3 text-sm">Shipped with <strong>{o.shipping.carrier}</strong>, tracking <strong>{o.shipping.tracking_no}</strong></p>}
          </section>
          <section aria-label="Customer" className="rounded-lg border border-line bg-white/60 p-4 md:p-6">
            <h2 className="mb-2 font-serif text-2xl">Customer</h2>
            <p>{o.customer.name || o.address.name}</p>
            <p><a className="underline" href={`https://wa.me/${o.customer.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{o.customer.phone}</a></p>
            {o.customer.email && <p className="break-all text-sm text-taupe">{o.customer.email}</p>}
          </section>
        </div>
      </div>

      <section aria-label="History" className="rounded-lg border border-line bg-white/60 p-4 md:p-6">
        <h2 className="mb-3 font-serif text-2xl">History</h2>
        <ol className="space-y-2 text-[15px]">
          {o.events.map((e, k) => (
            <li key={k} className="flex flex-wrap gap-x-3"><span className="w-44 shrink-0 text-taupe">{when(e.at)}</span><span>{STATUS_LABEL[e.to]} <span className="text-taupe">· by {e.actor}{e.note ? ` — ${e.note}` : ''}</span></span></li>
          ))}
        </ol>
      </section>

      {dialog === 'reject' && <ReasonDialog title="Reject payment" label="Why? (the customer is told)" cta="Reject payment" onClose={() => setDialog(null)} run={(r) => ordersApi.reject(id, r)} onDone={done('Payment rejected. The customer can upload again.')} />}
      {dialog === 'cancel' && <ReasonDialog title="Cancel order" label="Reason (the customer is told)" cta="Cancel order" danger note={o.status === 'PENDING_PAYMENT' ? 'Stock will be returned.' : 'Stock will be returned and a refund will be marked as due.'} onClose={() => setDialog(null)} run={(r) => ordersApi.cancel(id, r)} onDone={done('Order cancelled')} />}
      {dialog === 'refund' && <ReasonDialog title="Record refund" label="Refund reference / note" cta="Mark as refunded" note={`Do this after you have sent ${formatINR(o.totals.total_paise)} back to the customer.`} onClose={() => setDialog(null)} run={(r) => ordersApi.refund(id, r)} onDone={done('Refund recorded')} />}
      {dialog === 'ship' && <ShipDialog onClose={() => setDialog(null)} run={(c, t) => ordersApi.ship(id, c, t)} onDone={done('Marked as shipped. The customer has the tracking number.')} />}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><dt className="text-taupe">{k}</dt><dd>{v}</dd></div>;

function ReceiptViewer({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  // A fresh signed link each time it is opened: it expires after 5 minutes by design.
  const q = useQuery({ queryKey: ['receipt-url', orderId], queryFn: () => ordersApi.receiptUrl(orderId), enabled: open, staleTime: 0, gcTime: 0 });
  return (
    <div className="mt-4">
      {!open ? (
        <button className="btn-secondary" onClick={() => setOpen(true)}><Eye size={16} aria-hidden /> View receipt</button>
      ) : q.isLoading ? (
        <p role="status" className="text-taupe">Loading receipt…</p>
      ) : q.isError || !q.data ? (
        <p role="alert" className="text-danger">Could not load the receipt. <button className="underline" onClick={() => void q.refetch()}>Try again</button></p>
      ) : q.data.is_pdf ? (
        <a className="btn-secondary" href={q.data.url} target="_blank" rel="noopener noreferrer">Open PDF receipt</a>
      ) : (
        <a href={q.data.url} target="_blank" rel="noopener noreferrer"><img src={q.data.url} alt="Payment receipt uploaded by the customer" className="max-h-[480px] rounded border border-line object-contain" /></a>
      )}
    </div>
  );
}

function ReasonDialog({ title, label, cta, note, danger, onClose, run, onDone }: { title: string; label: string; cta: string; note?: string; danger?: boolean; onClose: () => void; run: (v: string) => Promise<OrderDetail>; onDone: (o: OrderDetail) => void }) {
  const [v, setV] = useState('');
  const m = useMutation({ mutationFn: () => run(v.trim()), onSuccess: onDone });
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) m.mutate(); }} className="space-y-4">
        {note && <p className="text-sm text-taupe">{note}</p>}
        <Field label={label}><textarea className="field !py-3" rows={3} maxLength={300} value={v} onChange={(e) => setV(e.target.value)} required /></Field>
        {m.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(m.error)}</p>}
        <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={onClose}>Back</button><button type="submit" className={`btn-primary ${danger ? '!bg-danger' : ''}`} disabled={!v.trim() || m.isPending}>{m.isPending ? 'Working…' : cta}</button></div>
      </form>
    </Modal>
  );
}

function ShipDialog({ onClose, run, onDone }: { onClose: () => void; run: (c: string, t: string) => Promise<OrderDetail>; onDone: (o: OrderDetail) => void }) {
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const m = useMutation({ mutationFn: () => run(carrier.trim(), tracking.trim()), onSuccess: onDone });
  return (
    <Modal title="Mark as shipped" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (carrier.trim() && tracking.trim()) m.mutate(); }} className="space-y-4">
        <Field label="Courier"><input className="field" value={carrier} maxLength={60} onChange={(e) => setCarrier(e.target.value)} placeholder="e.g. DTDC, India Post" required /></Field>
        <Field label="Tracking number" hint="Sent to the customer on WhatsApp"><input className="field" value={tracking} maxLength={80} onChange={(e) => setTracking(e.target.value)} required /></Field>
        {m.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(m.error)}</p>}
        <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={onClose}>Back</button><button type="submit" className="btn-primary" disabled={!carrier.trim() || !tracking.trim() || m.isPending}>{m.isPending ? 'Saving…' : 'Mark as shipped'}</button></div>
      </form>
    </Modal>
  );
}
