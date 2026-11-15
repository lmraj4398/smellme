import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { commerceApi, type OrderSummary, type SavedAddress } from '@/api/commerce';
import { wishlistApi } from '@/api/wishlist';
import { AddressFields } from '@/components/AddressForm';
import { ProductGrid } from '@/components/ProductGrid';
import { ScentProfileCard } from '@/components/ScentProfileCard';
import { Container, ErrorState, Loading } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiErrorMessage } from '@/lib/api-error';
import { emptyAddress, statusCopy, toAddress, validateAddress, type AddressForm } from '@/lib/checkout';
import { formatINR } from '@/lib/utils';
import { useCustomerStore } from '@/store/customer.store';

type Tab = 'overview' | 'orders' | 'wishlist' | 'addresses' | 'details';
const TABS: { id: Tab; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'orders', label: 'Orders' }, { id: 'wishlist', label: 'Wishlist' }, { id: 'addresses', label: 'Addresses' }, { id: 'details', label: 'Details' }];
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v);

export default function AccountPage() {
  usePageTitle('My account');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const customer = useCustomerStore((s) => s.customer);
  // ?tab=wishlist lets the header heart open the wishlist directly.
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (isTab(params.get('tab')) ? (params.get('tab') as Tab) : 'overview'));

  async function signOut() {
    // Signing out must work even when the server can't be reached: the local session is dropped regardless.
    try { await commerceApi.logout(); } catch { /* the cookie expires on its own */ }
    useCustomerStore.getState().clear();
    navigate('/', { replace: true });
    // Cleared after leaving this page, so its own queries can't re-create entries for the next person on this device.
    setTimeout(() => qc.clear(), 0);
  }

  return (
    <Container className="flex flex-wrap items-start gap-12 py-10 md:py-12">
      <nav aria-label="Account" className="flex w-full flex-col gap-1 md:max-w-[260px] md:flex-[1_1_220px]">
        <span className="font-serif text-[30px]">Hello{customer?.name ? `, ${customer.name.split(' ')[0]}` : ''}</span>
        <span className="mb-4 text-[13px] text-taupe">{customer?.phone}</span>
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:overflow-visible md:px-0">
          {TABS.map((t) => (
            <button key={t.id} aria-pressed={tab === t.id} onClick={() => setTab(t.id)} className={`min-h-12 shrink-0 rounded-full px-5 text-left text-[15px] ${tab === t.id ? 'bg-champagne font-medium' : 'hover:bg-pearl'}`}>{t.label}</button>
          ))}
          <button onClick={() => void signOut()} className="min-h-12 shrink-0 rounded-full px-5 text-left text-[15px] text-taupe hover:bg-pearl">Sign out</button>
        </div>
      </nav>
      <div className="min-w-0 flex-[999_1_560px]">
        {tab === 'overview' && <Overview onTab={setTab} />}
        {tab === 'orders' && <Orders />}
        {tab === 'wishlist' && <Wishlist />}
        {tab === 'addresses' && <Addresses />}
        {tab === 'details' && <Details />}
      </div>
    </Container>
  );
}

function Overview({ onTab }: { onTab: (t: Tab) => void }) {
  const orders = useQuery({ queryKey: ['my-orders'], queryFn: commerceApi.orders });
  const wish = useQuery({ queryKey: ['wishlist', 'list'], queryFn: wishlistApi.list });
  const recent = orders.data?.items.slice(0, 2) ?? [];
  const saved = wish.data?.slice(0, 3) ?? [];
  return (
    <div className="flex flex-col gap-12">
      <ScentProfileCard />

      {recent.length > 0 && (
        <section aria-label="Recent orders" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[32px] leading-none">Recent orders</h2>
            <button type="button" className="min-h-11 text-sm underline" onClick={() => onTab('orders')}>All orders</button>
          </div>
          <OrderList orders={recent} />
        </section>
      )}

      {saved.length > 0 && (
        <section aria-label="Saved fragrances" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-[32px] leading-none">Saved for later</h2>
            <button type="button" className="min-h-11 text-sm underline" onClick={() => onTab('wishlist')}>View wishlist</button>
          </div>
          <ProductGrid products={saved} layout="compact" />
        </section>
      )}

      {orders.isSuccess && wish.isSuccess && recent.length === 0 && saved.length === 0 && (
        <p className="text-taupe">Nothing here yet. <Link to="/shop" className="underline">Find a fragrance</Link> and it will show up here.</p>
      )}
    </div>
  );
}

function OrderList({ orders }: { orders: OrderSummary[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {orders.map((o) => (
          <li key={o.order_no}>
            <Link to={`/order/${o.order_no}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-line bg-white p-5 hover:border-gold">
              <div className="min-w-0 flex-1 basis-56">
                <div className="text-[13px] text-taupe">{o.order_no} · {new Date(o.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</div>
                <div className="font-serif text-2xl leading-tight">{o.items.map((i) => i.name).join(', ') || 'Order'}</div>
                <div className={`text-sm font-medium ${o.status === 'PENDING_PAYMENT' ? 'text-danger' : 'text-antique'}`}>{statusCopy(o.status).title}</div>
              </div>
              <span className="font-medium">{formatINR(o.total_paise)}</span>
              <span className="rounded-full border border-ink px-4 py-2 text-xs uppercase tracking-[0.14em]">{o.status === 'PENDING_PAYMENT' ? 'Pay now' : 'View'}</span>
            </Link>
          </li>
      ))}
    </ul>
  );
}

function Orders() {
  const q = useQuery({ queryKey: ['my-orders'], queryFn: commerceApi.orders });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  return (
    <section aria-label="Orders" className="flex flex-col gap-4">
      <h1 className="font-serif text-[40px] leading-none">Your orders</h1>
      {q.data.items.length === 0 && <p className="text-taupe">No orders yet. <Link to="/shop" className="underline">Find a fragrance</Link>.</p>}
      <OrderList orders={q.data.items} />
    </section>
  );
}

function Wishlist() {
  const q = useQuery({ queryKey: ['wishlist', 'list'], queryFn: wishlistApi.list });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;
  return (
    <section aria-label="Wishlist" className="flex flex-col gap-5">
      <h1 className="font-serif text-[40px] leading-none">Wishlist</h1>
      {q.data.length === 0 ? (
        <p className="text-taupe">Nothing saved yet. Tap the heart on a fragrance to keep it here. <Link to="/shop" className="underline">Browse fragrances</Link>.</p>
      ) : (
        <ProductGrid products={q.data} layout="compact" />
      )}
    </section>
  );
}

function Addresses() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['public-settings'], queryFn: commerceApi.settings, staleTime: 60_000 });
  const q = useQuery({ queryKey: ['addresses'], queryFn: commerceApi.addresses });
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const del = useMutation({ mutationFn: (id: string) => commerceApi.deleteAddress(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['addresses'] }); toast.success('Address removed'); }, onError: (e) => toast.error(apiErrorMessage(e)) });
  if (q.isLoading) return <Loading />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => void q.refetch()} />;

  return (
    <section aria-label="Addresses" className="flex flex-col gap-4">
      <h1 className="font-serif text-[40px] leading-none">Saved addresses</h1>
      <ul className="grid gap-4 sm:grid-cols-2">
        {q.data.map((a) => (
          <li key={a.id} className={`flex flex-col gap-2 rounded border p-5 ${a.is_default ? 'border-[1.5px] border-ink bg-white' : 'border-line bg-white/60'}`}>
            {a.is_default && <span className="eyebrow !text-[11px]">Default</span>}
            <span className="leading-relaxed text-[15px]"><strong>{a.name}</strong><br />{a.line1}{a.line2 && `, ${a.line2}`}<br />{a.city}, {a.state} {a.pincode}<br />{a.phone}</span>
            <div className="flex gap-4 pt-1"><button className="min-h-11 text-sm underline" onClick={() => setEditing(a)}>Edit</button><button className="min-h-11 text-sm text-taupe underline" onClick={() => confirm('Remove this address?') && del.mutate(a.id)}>Remove</button></div>
          </li>
        ))}
        {editing === null && <li><button className="min-h-[160px] w-full rounded border border-dashed border-field text-[15px]" onClick={() => setEditing('new')}>+ Add a new address</button></li>}
      </ul>
      {editing && <AddressEditor key={editing === 'new' ? 'new' : editing.id} item={editing === 'new' ? null : editing} states={settings.data?.states ?? []} onClose={() => setEditing(null)} />}
    </section>
  );
}

function AddressEditor({ item, states, onClose }: { item: SavedAddress | null; states: readonly string[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState<AddressForm>(item ? emptyAddress({ name: item.name, phone: item.phone, line1: item.line1, line2: item.line2 ?? '', city: item.city, state: item.state, pincode: item.pincode }) : emptyAddress());
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});
  const save = useMutation({
    mutationFn: () => commerceApi.saveAddress(item?.id ?? null, { ...toAddress(v), label: item?.label ?? '', is_default: item?.is_default }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['addresses'] }); toast.success('Address saved'); onClose(); },
  });
  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); const f = validateAddress(v, states); setErrors(f); if (!Object.keys(f).length) save.mutate(); }} className="flex flex-col gap-4 rounded border border-line bg-white p-5">
      <h2 className="font-serif text-2xl">{item ? 'Edit address' : 'New address'}</h2>
      <AddressFields value={v} errors={errors} states={states} onChange={setV} />
      {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
      <div className="flex gap-3"><button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save address'}</button><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button></div>
    </form>
  );
}

function Details() {
  const customer = useCustomerStore((s) => s.customer)!;
  const setCustomer = useCustomerStore((s) => s.setCustomer);
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [birthday, setBirthday] = useState(customer.birthday ?? '');
  const [err, setErr] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => commerceApi.updateMe({ name: name.trim(), ...(email.trim() ? { email: email.trim() } : {}), birthday }), onSuccess: (c) => { setCustomer(c); toast.success('Saved'); }, onError: (e) => setErr(apiErrorMessage(e)) });
  return (
    <section aria-label="Details" className="flex max-w-lg flex-col gap-4">
      <h1 className="font-serif text-[40px] leading-none">Your details</h1>
      <form noValidate onSubmit={(e) => { e.preventDefault(); setErr(null); if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return setErr('Enter a valid email address'); save.mutate(); }} className="flex flex-col gap-4">
        <div><label htmlFor="d-name" className="label">Name</label><input id="d-name" className="field" value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="d-phone" className="label">Mobile (WhatsApp)</label><input id="d-phone" className="field" value={customer.phone} readOnly aria-describedby="d-phone-note" /><p id="d-phone-note" className="mt-1 text-sm text-taupe">Your mobile number is how you sign in, so it can’t be changed here.</p></div>
        <div><label htmlFor="d-email" className="label">Email <span className="font-normal text-taupe">optional</span></label><input id="d-email" type="email" className="field" value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} /></div>
        <div>
          <label htmlFor="d-birthday" className="label">Birthday <span className="font-normal text-taupe">optional</span></label>
          <input id="d-birthday" type="date" className="field" value={birthday} min="1900-01-01" max={new Date().toISOString().slice(0, 10)} autoComplete="bday" onChange={(e) => setBirthday(e.target.value)} />
          <p className="mt-1 text-sm text-taupe">We’ll send you a free sample around your birthday.</p>
        </div>
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <button type="submit" className="btn-primary self-start" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
      </form>
    </section>
  );
}
