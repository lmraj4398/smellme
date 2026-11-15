import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { commerceApi, type PricedLine } from '@/api/commerce';
import { Bottle } from '@/components/ui/Bottle';
import { Container, ErrorState, Skeleton } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn, formatINR } from '@/lib/utils';
import { bagToInput, MAX_QTY, useBag, type BagLine } from '@/store/cart.store';

export default function BagPage() {
  usePageTitle('Your bag');
  const navigate = useNavigate();
  const lines = useBag((s) => s.lines);
  const options = useBag((s) => s.options);
  const { setQty, remove, setOptions } = useBag.getState();
  const input = bagToInput(lines, options);

  // Prices come from the server every time: the numbers saved in the browser are for display until this answers.
  const price = useQuery({
    queryKey: ['bag-price', input],
    queryFn: () => commerceApi.priceCart(input),
    enabled: lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  const settings = useQuery({ queryKey: ['public-settings'], queryFn: commerceApi.settings, staleTime: 60_000 });
  const samples = useQuery({ queryKey: ['samples'], queryFn: commerceApi.samples, staleTime: 60_000 });
  const p = price.data;
  const priced = new Map((p?.lines ?? []).filter((l) => !l.is_free_sample).map((l) => [l.variant_id, l]));
  const issueFor = (l: BagLine): PricedLine | undefined => priced.get(l.variantId)?.issue ? priced.get(l.variantId) : undefined;
  const blocked = !p || p.issues.length > 0 || price.isFetching;
  const allowed = p?.free_samples_allowed ?? settings.data?.free_samples_count ?? 0;

  const [coupon, setCoupon] = useState(options.coupon_code);

  if (lines.length === 0) {
    return (
      <Container className="flex flex-col items-center gap-5 py-24 text-center">
        <h1 className="font-serif text-5xl">Your bag is empty</h1>
        <p className="max-w-md text-taupe">Find a fragrance you love. Every one can be tried as a 2 ml sample first.</p>
        <Link to="/shop" className="btn-primary min-h-[54px] px-8">Continue shopping</Link>
      </Container>
    );
  }

  return (
    <Container className="flex flex-wrap items-start gap-12 py-10 md:py-12">
      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-8">
        <div className="flex items-baseline gap-4">
          <h1 className="font-serif text-[clamp(44px,5vw,64px)] leading-none">Your bag</h1>
          <span className="text-taupe">{lines.reduce((n, l) => n + l.qty, 0)} items</span>
        </div>

        {p && p.free_delivery_over_paise > 0 && (
          <div className="rounded bg-pearl px-5 py-4">
            <p className="text-sm">{p.delivery_fee_paise === 0 && p.subtotal_paise > 0 ? 'You’ve unlocked free delivery.' : `Add ${formatINR(Math.max(0, p.free_delivery_over_paise - p.subtotal_paise))} more for free delivery.`}</p>
            <div aria-hidden className="mt-2 h-[3px] rounded bg-line"><div className="h-[3px] rounded bg-antique" style={{ width: `${Math.min(100, Math.round((p.subtotal_paise / p.free_delivery_over_paise) * 100))}%` }} /></div>
          </div>
        )}

        {price.isError && <ErrorState message="We couldn’t check your prices just now." onRetry={() => void price.refetch()} />}

        <ul className="border-t border-ink">
          {lines.map((l) => {
            const issue = issueFor(l);
            const server = priced.get(l.variantId);
            return (
              <li key={l.variantId} className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-3 border-b border-line py-6 sm:grid-cols-[120px_minmax(0,1fr)_auto] sm:gap-x-6">
                <Link to={`/product/${l.productSlug}`} aria-hidden tabIndex={-1} className="row-span-2 flex h-[120px] items-end justify-center overflow-hidden rounded-t-[60px] rounded-b-[3px] pb-4 sm:h-[150px]" style={{ background: l.tint }}>
                  {l.image ? <img src={l.image} alt="" className="h-full w-full object-cover" /> : <Bottle liquid={l.liquid} mono={l.mono} className="!w-[52%]" />}
                </Link>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <span className="eyebrow !text-[11px]">{l.brand}</span>
                  <Link to={`/product/${l.productSlug}`} className="font-serif text-[26px] leading-[1.1] hover:text-antique">{l.name}</Link>
                  <span className="text-sm text-taupe">{l.label} · {formatINR(server?.unit_price_paise ?? l.price_paise)} each</span>
                  {issue && (
                    <p role="alert" className="mt-1 rounded bg-danger/10 px-3 py-2 text-sm text-danger">
                      {issue.issue === 'unavailable'
                        ? 'This item is no longer available.'
                        : issue.available ? `Only ${issue.available} left.` : 'Sold out.'}{' '}
                      {issue.issue === 'insufficient_stock' && !!issue.available && <button className="underline" onClick={() => setQty(l.variantId, issue.available!)}>Reduce to {issue.available}</button>}
                      {(issue.issue === 'unavailable' || !issue.available) && <button className="underline" onClick={() => remove(l.variantId)}>Remove</button>}
                    </p>
                  )}
                  <button className="mt-1 flex min-h-11 w-fit items-center gap-1.5 text-sm text-taupe underline" onClick={() => remove(l.variantId)}><Trash2 size={14} aria-hidden /> Remove</button>
                </div>
                <div className="col-start-2 flex items-center justify-between gap-6 sm:col-start-3 sm:row-start-1 sm:flex-col sm:items-end sm:justify-start">
                  <div role="group" aria-label={`Quantity of ${l.name}`} className="flex items-center rounded-full border border-field">
                    <button type="button" aria-label="Decrease" disabled={l.qty <= 1} onClick={() => setQty(l.variantId, l.qty - 1)} className="h-11 w-11 text-lg disabled:opacity-30">−</button>
                    <span className="min-w-[22px] text-center" aria-live="polite">{l.qty}</span>
                    <button type="button" aria-label="Increase" disabled={l.qty >= MAX_QTY} onClick={() => setQty(l.variantId, l.qty + 1)} className="h-11 w-11 text-lg disabled:opacity-30">+</button>
                  </div>
                  <span className="min-w-24 text-right text-[17px] font-medium">{server && !issue ? formatINR(server.line_total_paise) : '—'}</span>
                </div>
              </li>
            );
          })}
        </ul>

        {/* free samples */}
        {allowed > 0 && !!samples.data?.length && (
          <section aria-label="Free samples" className="flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-[32px]">Choose {allowed} free sample{allowed === 1 ? '' : 's'}</h2>
              <span className="text-sm text-taupe">{options.free_sample_ids.length} of {allowed} chosen</span>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {samples.data.map((s) => {
                const on = options.free_sample_ids.includes(s.variant_id);
                const full = !on && options.free_sample_ids.length >= allowed;
                return (
                  <li key={s.variant_id}>
                    <button type="button" aria-pressed={on} disabled={full}
                      onClick={() => setOptions({ free_sample_ids: on ? options.free_sample_ids.filter((x) => x !== s.variant_id) : [...options.free_sample_ids, s.variant_id] })}
                      className={cn('flex min-h-[112px] w-full flex-col items-center justify-center gap-2 rounded p-3 text-center', on ? 'border-[1.5px] border-ink bg-white' : 'border border-line bg-ivory', full && 'opacity-50')}>
                      <span aria-hidden className="flex flex-col items-center"><span className="h-2 w-2.5 rounded-[1px] bg-gold" /><span className="h-[46px] w-[18px] rounded-b-[9px]" style={{ background: s.liquid }} /></span>
                      <span className="text-sm leading-tight">{s.product_name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* gift options */}
        <section aria-label="Gift options" className="flex flex-col gap-4 rounded border border-line bg-white/60 p-5">
          <label className="flex min-h-11 items-center gap-3 text-[15px]">
            <input type="checkbox" checked={options.gift_wrap} onChange={(e) => setOptions({ gift_wrap: e.target.checked })} />
            Signature gift wrap &amp; handwritten note{settings.data ? ` · ${formatINR(settings.data.gift_wrap_paise)}` : ''}
          </label>
          {options.gift_wrap && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium">Gift message
                <textarea rows={3} maxLength={250} value={options.gift_message} onChange={(e) => setOptions({ gift_message: e.target.value })} placeholder="We’ll handwrite this on our card" className="field !py-3 font-normal" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-medium">Engraving <span className="font-normal text-taupe">(up to 14 characters, optional)</span>
                <input maxLength={14} value={options.engraving} onChange={(e) => setOptions({ engraving: e.target.value.replace(/[^A-Za-z0-9 .'&-]/g, '') })} className="field font-normal" />
              </label>
            </div>
          )}
        </section>
      </div>

      {/* summary */}
      <aside aria-label="Order summary" className="flex min-w-0 max-w-[460px] flex-[1_1_340px] flex-col gap-[18px] rounded-md border border-line bg-white p-8">
        <h2 className="font-serif text-[32px] leading-none">Summary</h2>
        {!p ? <Skeleton className="h-32" /> : (
          <dl className="flex flex-col gap-3 text-[15px]">
            <Row k="Subtotal" v={formatINR(p.subtotal_paise)} />
            {p.discount_paise > 0 && <Row k={`Coupon ${p.coupon?.code ?? ''}`} v={`− ${formatINR(p.discount_paise)}`} />}
            {p.gift_wrap_paise > 0 && <Row k="Gift wrap & note" v={formatINR(p.gift_wrap_paise)} />}
            <Row k="Delivery" v={p.delivery_fee_paise ? formatINR(p.delivery_fee_paise) : 'Free'} />
          </dl>
        )}

        <form onSubmit={(e) => { e.preventDefault(); setOptions({ coupon_code: coupon.trim() }); }} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <label htmlFor="coupon" className="sr-only">Coupon code</label>
            <input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value)} maxLength={40} placeholder="Coupon code" className="field !min-h-12 min-w-0 flex-1 uppercase" />
            <button type="submit" className="btn-secondary !min-h-12 !px-5" disabled={coupon.trim() === options.coupon_code}>Apply</button>
          </div>
          {options.coupon_code && p?.coupon_error && <p role="alert" className="text-sm text-danger">{p.coupon_error}</p>}
          {options.coupon_code && p?.coupon && <p className="text-sm text-ok">“{p.coupon.code}” applied.{' '}<button type="button" className="underline" onClick={() => { setCoupon(''); setOptions({ coupon_code: '' }); }}>Remove</button></p>}
        </form>

        <div className="flex items-baseline justify-between border-t border-ink pt-[18px]">
          <span className="font-medium">Total <span className="text-[13px] font-normal text-taupe">incl. taxes</span></span>
          <span className="font-serif text-4xl">{p ? formatINR(p.total_paise) : '—'}</span>
        </div>
        <button type="button" className="btn-primary min-h-14" disabled={blocked} onClick={() => navigate('/checkout')}>{p?.issues.length ? 'Fix the items above to continue' : 'Checkout securely'}</button>
        <p className="text-center text-[13px] text-taupe">You’ll pay by UPI on the next steps. We ship once your payment is confirmed.</p>
        <Link to="/shop" className="text-center text-sm underline">Continue shopping</Link>
      </aside>
    </Container>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => <div className="flex justify-between"><dt>{k}</dt><dd>{v}</dd></div>;
