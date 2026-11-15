import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { commerceApi, type SavedAddress } from '@/api/commerce';
import { AddressFields } from '@/components/AddressForm';
import { Container, Loading } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiErrorMessage } from '@/lib/api-error';
import { emptyAddress, toAddress, validateAddress, type AddressForm } from '@/lib/checkout';
import { formatINR } from '@/lib/utils';
import { bagToInput, useBag } from '@/store/cart.store';
import { useCustomerStore } from '@/store/customer.store';

const REF_KEY = 'smellme-checkout-ref';

/**
 * One reference per checkout attempt, kept across reloads and retries: if the request succeeded but the
 * answer was lost (or the button was pressed twice), re-sending returns the SAME order instead of a second one.
 * A different bag gets a new reference.
 */
export function checkoutRef(signature: string): string {
  try {
    const saved = JSON.parse(sessionStorage.getItem(REF_KEY) ?? 'null') as { ref: string; sig: string } | null;
    if (saved && saved.sig === signature && /^[0-9a-f-]{36}$/i.test(saved.ref)) return saved.ref;
  } catch { /* fall through to a fresh one */ }
  const ref = crypto.randomUUID();
  try { sessionStorage.setItem(REF_KEY, JSON.stringify({ ref, sig: signature })); } catch { /* private mode: still works, just not across reloads */ }
  return ref;
}
export const clearCheckoutRef = () => { try { sessionStorage.removeItem(REF_KEY); } catch { /* ignore */ } };

const fromSaved = (a: SavedAddress): AddressForm => emptyAddress({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 ?? '', city: a.city, state: a.state, pincode: a.pincode });

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const customer = useCustomerStore((s) => s.customer);
  const lines = useBag((s) => s.lines);
  const options = useBag((s) => s.options);
  const input = bagToInput(lines, options);

  const price = useQuery({ queryKey: ['bag-price', input], queryFn: () => commerceApi.priceCart(input), enabled: lines.length > 0, placeholderData: keepPreviousData });
  const settings = useQuery({ queryKey: ['public-settings'], queryFn: commerceApi.settings, staleTime: 60_000 });
  const saved = useQuery({ queryKey: ['addresses'], queryFn: commerceApi.addresses });

  const [selected, setSelected] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<AddressForm>(() => emptyAddress({ name: customer?.name ?? '', phone: customer?.phone.replace('+91', '') ?? '' }));
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const [saveIt, setSaveIt] = useState(true);
  const [pincodeNote, setPincodeNote] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once the order exists the bag is emptied; that must not bounce the shopper to "your bag is empty" on the way to their order.
  const placed = useRef(false);

  useEffect(() => {
    if (saved.data && selected === null) setSelected(saved.data.find((a) => a.is_default)?.id ?? saved.data[0]?.id ?? 'new');
  }, [saved.data, selected]);

  if (lines.length === 0 && !placed.current) return <Navigate to="/bag" replace />;
  if (saved.isLoading || selected === null) return <Loading />;

  const states = settings.data?.states ?? [];
  const p = price.data;
  const chosen = selected === 'new' ? null : saved.data?.find((a) => a.id === selected) ?? null;

  async function checkPincode() {
    if (!/^[1-9]\d{5}$/.test(form.pincode)) return setPincodeNote(undefined);
    try {
      const r = await commerceApi.checkPincode(form.pincode);
      setPincodeNote(r.serviceable ? `We deliver here · ${r.eta_text}` : 'Sorry, we can’t deliver to this pincode yet');
    } catch { setPincodeNote(undefined); }
  }

  async function place() {
    setError(null);
    let address;
    if (chosen) {
      address = toAddress(fromSaved(chosen));
    } else {
      const found = validateAddress(form, states);
      setErrors(found);
      if (Object.keys(found).length) {
        requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
        return;
      }
      address = toAddress(form);
    }
    setBusy(true);
    try {
      const ref = checkoutRef(JSON.stringify(input));
      const order = await commerceApi.createOrder({ ...input, client_ref: ref, address, ...(options.gift_wrap && options.gift_message.trim() ? { gift_message: options.gift_message.trim() } : {}), ...(options.gift_wrap && options.engraving.trim() ? { engraving: options.engraving.trim() } : {}) });
      if (!chosen && saveIt) {
        // Remembering the address is a convenience: its failure must never undo a placed order.
        void commerceApi.saveAddress(null, { ...address, is_default: !saved.data?.length }).then(() => qc.invalidateQueries({ queryKey: ['addresses'] })).catch(() => undefined);
      }
      placed.current = true;
      clearCheckoutRef();
      useBag.getState().clear();
      void qc.invalidateQueries({ queryKey: ['my-orders'] });
      navigate(`/order/${order.order_no}`, { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e, 'We couldn’t place your order. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Container className="flex flex-wrap items-start gap-12 py-10 md:py-12">
      <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-10">
        <h1 className="font-serif text-[clamp(44px,5vw,64px)] leading-none">Checkout</h1>

        <section aria-label="Delivery address" className="flex flex-col gap-4">
          <h2 className="font-serif text-[32px]">Delivery address</h2>
          {!!saved.data?.length && (
            <ul className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Saved addresses">
              {saved.data.map((a) => (
                <li key={a.id}>
                  <label className={`flex min-h-full cursor-pointer gap-3 rounded border p-4 ${selected === a.id ? 'border-[1.5px] border-ink bg-white' : 'border-line bg-ivory'}`}>
                    <input type="radio" name="address" checked={selected === a.id} onChange={() => setSelected(a.id)} className="mt-1" />
                    <span className="text-[15px] leading-relaxed"><strong>{a.name}</strong>{a.label && <span className="text-taupe"> · {a.label}</span>}<br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</span>
                  </label>
                </li>
              ))}
              <li>
                <label className={`flex min-h-full cursor-pointer items-center gap-3 rounded border border-dashed p-4 ${selected === 'new' ? 'border-ink bg-white' : 'border-field'}`}>
                  <input type="radio" name="address" checked={selected === 'new'} onChange={() => setSelected('new')} /> Use a new address
                </label>
              </li>
            </ul>
          )}
          {selected === 'new' && (
            <div className="flex flex-col gap-4">
              <AddressFields value={form} errors={errors} states={states} onChange={setForm} onPincodeBlur={() => void checkPincode()} pincodeNote={pincodeNote} />
              <label className="flex min-h-11 items-center gap-3 text-[15px]"><input type="checkbox" checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} /> Save this address for next time</label>
            </div>
          )}
        </section>

        <section aria-label="Payment" className="rounded border border-line bg-pearl p-5">
          <h2 className="font-serif text-[28px]">How you’ll pay</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-[#4A4238]">
            <li>Place your order. We hold your items.</li>
            <li>Scan the UPI QR code and pay the exact amount shown.</li>
            <li>Upload a screenshot of the payment. We confirm it and ship.</li>
          </ol>
        </section>
      </div>

      <aside aria-label="Your order" className="flex min-w-0 max-w-[460px] flex-[1_1_340px] flex-col gap-[18px] rounded-md bg-pearl p-7">
        <div className="flex items-baseline justify-between"><h2 className="font-serif text-[28px] leading-none">Your order</h2><Link to="/bag" className="text-[13px] underline">Edit bag</Link></div>
        {!p ? <Loading /> : (
          <>
            <ul className="flex flex-col gap-3">
              {p.lines.map((l) => (
                <li key={l.variant_id + (l.is_free_sample ? 'f' : '')} className="flex items-baseline justify-between gap-3 text-[15px]">
                  <span>{l.name} <span className="text-taupe">· {l.label} × {l.qty}{l.is_free_sample ? ' · free sample' : ''}</span>{l.issue && <span role="alert" className="block text-sm text-danger">{l.issue === 'unavailable' ? 'No longer available' : 'Not enough in stock'}</span>}</span>
                  <span>{l.is_free_sample ? 'Free' : l.issue ? '—' : formatINR(l.line_total_paise)}</span>
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-2.5 border-t border-[#DCCFBA] pt-4 text-[15px]">
              <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatINR(p.subtotal_paise)}</dd></div>
              {p.discount_paise > 0 && <div className="flex justify-between"><dt>Coupon {p.coupon?.code}</dt><dd>− {formatINR(p.discount_paise)}</dd></div>}
              {p.gift_wrap_paise > 0 && <div className="flex justify-between"><dt>Gift wrap</dt><dd>{formatINR(p.gift_wrap_paise)}</dd></div>}
              <div className="flex justify-between"><dt>Delivery</dt><dd>{p.delivery_fee_paise ? formatINR(p.delivery_fee_paise) : 'Free'}</dd></div>
            </dl>
            <div className="flex items-baseline justify-between border-t border-ink pt-4"><span className="font-medium">Total to pay</span><span className="font-serif text-4xl">{formatINR(p.total_paise)}</span></div>
          </>
        )}
        {error && (
          <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{error} <Link to="/bag" className="underline">Review your bag</Link></p>
        )}
        <button type="button" className="btn-primary min-h-[58px]" disabled={busy || !p || p.issues.length > 0} onClick={() => void place()}>{busy ? 'Placing your order…' : 'Place order'}</button>
        <p className="text-center text-[13px] text-taupe">You won’t be charged yet. Payment is the next step.</p>
      </aside>
    </Container>
  );
}
