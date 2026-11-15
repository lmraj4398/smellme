import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Check, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { commerceApi, type OrderView } from '@/api/commerce';
import { Container, ErrorState, Loading } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiErrorMessage } from '@/lib/api-error';
import { completedSteps, LIVE_STATUSES, ORDER_STEPS, receiptProblem, rupeesToPaise, statusCopy } from '@/lib/checkout';
import { cn, formatINR } from '@/lib/utils';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

export default function OrderPage() {
  const { orderNo = '' } = useParams();
  usePageTitle(`Order ${orderNo}`);
  const qc = useQueryClient();
  // Staff verify payments and ship from the admin: keep this page current while the order is still moving.
  const q = useQuery({
    queryKey: ['order', orderNo],
    queryFn: () => commerceApi.order(orderNo),
    refetchInterval: (query) => (query.state.data && LIVE_STATUSES.includes(query.state.data.status) ? 20_000 : false),
    retry: (n, e) => !(axios.isAxiosError(e) && e.response?.status === 404) && n < 2,
  });
  const update = (o: OrderView) => { qc.setQueryData(['order', orderNo], o); void qc.invalidateQueries({ queryKey: ['my-orders'] }); };

  const cancel = useMutation({ mutationFn: () => commerceApi.cancelOrder(orderNo), onSuccess: (o) => { update(o); toast.success('Order cancelled'); }, onError: (e) => toast.error(apiErrorMessage(e)) });

  if (q.isLoading) return <Loading />;
  if (axios.isAxiosError(q.error) && q.error.response?.status === 404) {
    return (
      <Container className="flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="font-serif text-5xl">Order not found</h1>
        <p className="text-taupe">We couldn’t find that order on your account.</p>
        <Link to="/account" className="btn-primary">Your orders</Link>
      </Container>
    );
  }
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  const o = q.data;
  const copy = statusCopy(o.status);
  const done = completedSteps(o.timeline);
  const dead = o.status === 'CANCELLED' || o.status === 'REFUNDED';

  return (
    <Container className="flex flex-col gap-10 py-10 md:py-12">
      <header className="flex flex-col gap-2">
        <span className="eyebrow">Order {o.order_no}</span>
        <h1 className="font-serif text-[clamp(40px,5vw,64px)] leading-none">{copy.title}</h1>
        <p className="max-w-2xl text-[17px] leading-relaxed text-[#4A4238]">{o.status === 'CANCELLED' && o.cancel_reason ? `${copy.text} Reason: ${o.cancel_reason}.` : copy.text}</p>
        {o.status === 'CANCELLED' && o.refund_due && <p role="status" className="max-w-2xl rounded bg-pearl px-4 py-3 text-[15px]">If you had already paid, we’ll refund {formatINR(o.totals.total_paise)} and message you on WhatsApp.</p>}
      </header>

      {!dead && (
        <ol aria-label="Order progress" className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {ORDER_STEPS.map((s) => (
            <li key={s.key} className={cn('flex flex-col gap-1 border-t-[3px] pt-3', done.includes(s.key) ? 'border-antique' : 'border-line')}>
              <span className="flex items-center gap-1.5 text-[15px] font-medium">{done.includes(s.key) && <Check size={14} aria-label="done" />}{s.label}</span>
              <span className="text-[13px] text-taupe">{when(o.timeline[s.key])}</span>
            </li>
          ))}
        </ol>
      )}

      {o.status === 'PENDING_PAYMENT' && (
        <>
          {o.payment_reject_reason && (
            <div role="alert" className="rounded border border-danger/40 bg-danger/5 p-4">
              <p className="font-medium text-danger">We couldn’t confirm your last payment</p>
              <p className="mt-1">{o.payment_reject_reason}</p>
              <p className="mt-1 text-sm text-taupe">Please check and upload your receipt again below.</p>
            </div>
          )}
          <PaymentPanel o={o} onSubmitted={update} />
        </>
      )}

      {o.shipping && (
        <section aria-label="Shipping" className="rounded border border-line bg-white p-5">
          <h2 className="font-serif text-2xl">Tracking</h2>
          <p className="mt-1">Shipped with <strong>{o.shipping.carrier}</strong> on {when(o.shipping.shipped_at)}. Tracking number: <strong>{o.shipping.tracking_no}</strong></p>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <section aria-label="Items" className="rounded border border-line bg-white p-5 md:p-6">
          <h2 className="mb-3 font-serif text-2xl">Your order</h2>
          <ul className="divide-y divide-line">
            {o.items.map((i, k) => (
              <li key={k} className="flex flex-wrap justify-between gap-2 py-3 text-[15px]">
                <span>{i.name} <span className="text-taupe">· {i.label} × {i.qty}{i.is_free_sample ? ' · free sample' : ''}</span></span>
                <span>{i.is_free_sample ? 'Free' : formatINR(i.line_total_paise)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-3 space-y-1 border-t border-line pt-3 text-[15px]">
            <div className="flex justify-between"><dt className="text-taupe">Subtotal</dt><dd>{formatINR(o.totals.subtotal_paise)}</dd></div>
            {o.totals.discount_paise > 0 && <div className="flex justify-between"><dt className="text-taupe">Coupon {o.coupon_code}</dt><dd>− {formatINR(o.totals.discount_paise)}</dd></div>}
            {o.totals.gift_wrap_paise > 0 && <div className="flex justify-between"><dt className="text-taupe">Gift wrap</dt><dd>{formatINR(o.totals.gift_wrap_paise)}</dd></div>}
            <div className="flex justify-between"><dt className="text-taupe">Delivery</dt><dd>{o.totals.delivery_fee_paise ? formatINR(o.totals.delivery_fee_paise) : 'Free'}</dd></div>
            <div className="flex justify-between border-t border-ink pt-2 text-lg font-medium"><dt>Total</dt><dd>{formatINR(o.totals.total_paise)}</dd></div>
          </dl>
        </section>
        <section aria-label="Delivery" className="rounded border border-line bg-white p-5 md:p-6">
          <h2 className="mb-3 font-serif text-2xl">Delivering to</h2>
          <address className="not-italic leading-relaxed">{o.address.name}<br />{o.address.line1}{o.address.line2 && <><br />{o.address.line2}</>}<br />{o.address.city}, {o.address.state} {o.address.pincode}<br />{o.address.phone}</address>
          {o.gift.wrap && <p className="mt-3 text-sm text-taupe">Gift wrapped{o.gift.engraving && <> · engraving “{o.gift.engraving}”</>}</p>}
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link to="/account" className="btn-secondary">All my orders</Link>
        <Link to="/shop" className="text-sm underline">Keep shopping</Link>
        {o.can_cancel && <button className="ml-auto min-h-11 text-sm text-danger underline" disabled={cancel.isPending} onClick={() => confirm('Cancel this order? Your items go back on the shelf.') && cancel.mutate()}>Cancel this order</button>}
      </div>
    </Container>
  );
}

function PaymentPanel({ o, onSubmitted }: { o: OrderView; onSubmitted: (o: OrderView) => void }) {
  const [copied, setCopied] = useState(false);
  const pay = o.payment;
  if (!pay) return null;
  if ('unavailable' in pay) {
    return <p role="alert" className="rounded border border-danger/40 bg-danger/5 p-5">Online payment isn’t set up right now. Please <Link to="/help" className="underline">contact us</Link> with your order number {o.order_no} and we’ll help you pay.</p>;
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(pay.upi_vpa); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error('Couldn’t copy. Please select and copy it.'); }
  };

  return (
    <section aria-label="Pay by UPI" className="grid gap-8 rounded-md border border-line bg-white p-6 md:grid-cols-[auto_1fr] md:p-8">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded border border-line bg-white p-3"><QRCodeSVG value={pay.upi_uri} size={208} level="M" role="img" aria-label={`UPI QR code to pay ${pay.payee_name}`} /></div>
        <a href={pay.upi_uri} className="btn-secondary !min-h-11 md:hidden">Open UPI app</a>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-taupe">Amount to pay</p>
          <p className="font-serif text-[56px] leading-none">{formatINR(pay.amount_paise)}</p>
        </div>
        <p role="note" className="rounded bg-champagne/60 px-4 py-3 text-[15px]"><strong>Please pay exactly {formatINR(pay.amount_paise)}.</strong> The QR code doesn’t fill in the amount, so type it in your payment app. A different amount delays your order.</p>
        <p className="text-[15px]">Paying <strong>{pay.payee_name}</strong> · UPI ID <strong className="break-all">{pay.upi_vpa}</strong>{' '}
          <button type="button" onClick={() => void copy()} className="ml-1 inline-flex min-h-9 items-center gap-1 text-sm underline">{copied ? <><Check size={14} aria-hidden /> Copied</> : <><Copy size={14} aria-hidden /> Copy</>}</button></p>
        <p className="text-sm text-taupe">Add <strong>{pay.reference}</strong> as the payment note if your app lets you.</p>
        <ReceiptUpload o={o} onSubmitted={onSubmitted} />
      </div>
    </section>
  );
}

function ReceiptUpload({ o, onSubmitted }: { o: OrderView; onSubmitted: (o: OrderView) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [utr, setUtr] = useState('');
  const [amount, setAmount] = useState(String(o.totals.total_paise / 100));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError('Please choose your payment screenshot first.');
    const bad = receiptProblem(file);
    if (bad) return setError(bad);
    if (utr.trim() && !/^[A-Za-z0-9]{6,30}$/.test(utr.trim())) return setError('The payment reference should be 6-30 letters or numbers, or leave it blank.');
    const paid = amount.trim() ? rupeesToPaise(amount) : null;
    if (amount.trim() && paid === null) return setError('Enter the amount you paid, like 2850.');
    setError(null);
    setBusy(true);
    try {
      const pre = await commerceApi.presignReceipt(o.order_no, file.type, file.size);
      // Straight to the private bucket (not through our API). The headers must be exactly those that were signed.
      const put = await fetch(pre.upload_url, { method: 'PUT', headers: pre.headers, body: file });
      if (!put.ok) throw new Error('The upload didn’t go through. Please try again.');
      onSubmitted(await commerceApi.submitReceipt(o.order_no, { key: pre.key, ...(utr.trim() ? { utr: utr.trim() } : {}), ...(paid !== null ? { paid_amount_paise: paid } : {}) }));
      toast.success('Thanks! We’re checking your payment.');
    } catch (err) {
      setError(apiErrorMessage(err, 'We couldn’t send your receipt. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 flex flex-col gap-4 border-t border-line pt-5">
      <h3 className="font-serif text-2xl">After paying, upload your receipt</h3>
      <div>
        <label htmlFor="receipt" className="label">Payment screenshot or PDF</label>
        <input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(null); }} className="block w-full text-[15px] file:mr-4 file:min-h-11 file:rounded-full file:border file:border-ink file:bg-transparent file:px-5" />
        {file && <p className="mt-1 text-sm text-taupe">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="utr" className="label">Payment reference (UTR) <span className="font-normal text-taupe">optional</span></label><input id="utr" className="field" value={utr} maxLength={30} autoComplete="off" onChange={(e) => setUtr(e.target.value)} /></div>
        <div><label htmlFor="paid" className="label">Amount you paid (₹)</label><input id="paid" className="field" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary min-h-14 self-start px-8">{busy ? 'Sending…' : 'I’ve paid — send receipt'}</button>
    </form>
  );
}
