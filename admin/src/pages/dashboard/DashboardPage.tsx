import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/api/orders.api';
import { PageHeader } from '@/components/ui/bits';
import { formatINR } from '@/lib/utils';
import { canOpenScreen, useAuthStore } from '@/store/auth.store';

interface Card { label: string; value: string | number; to: string; hot?: boolean; hint?: string }

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const canSee = canOpenScreen(user, 'orders');
  const q = useQuery({ queryKey: ['orders-summary'], queryFn: ordersApi.summary, enabled: canSee, refetchInterval: 60_000, retry: false });
  const s = q.data;

  const cards: Card[] = s ? [
    { label: 'Payments to verify', value: s.awaiting_verification, to: '/payments', hot: s.awaiting_verification > 0, hint: 'Customers are waiting for these' },
    { label: 'Ready to pack', value: s.to_pack, to: '/orders?status=PAID', hot: s.to_pack > 0, hint: 'Payment confirmed' },
    { label: 'Ready to ship', value: s.to_ship, to: '/orders?status=PACKED' },
    { label: 'Refunds due', value: s.refunds_due, to: '/orders?status=CANCELLED', hot: s.refunds_due > 0, hint: 'Cancelled after payment' },
    { label: 'Low or sold out', value: s.low_stock_variants, to: '/inventory', hot: s.low_stock_variants > 0, hint: 'Sizes at or below their alert level' },
    { label: 'Verified today', value: formatINR(s.today.verified_sales_paise), to: '/orders', hint: `${s.today.verified_orders} order${s.today.verified_orders === 1 ? '' : 's'}` },
  ] : [];

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.name ?? ''}`} subtitle={canSee ? 'What needs your attention right now.' : 'Use the menu to open the screens you have access to.'} />
      {canSee && q.isLoading && <p role="status" className="py-8 text-taupe">Loading…</p>}
      {canSee && q.isError && <p role="alert" className="py-4 text-taupe">Couldn’t load today’s numbers. <button className="underline" onClick={() => void q.refetch()}>Try again</button></p>}
      {s && (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <li key={c.label}>
              <Link to={c.to} className={`block rounded-lg border p-5 transition hover:shadow-sm ${c.hot ? 'border-antique bg-champagne/40' : 'border-line bg-white/60'}`}>
                <div className="text-sm text-taupe">{c.label}</div>
                <div className="mt-1 font-serif text-5xl leading-none">{c.value}</div>
                {c.hint && <div className="mt-2 text-sm text-taupe">{c.hint}</div>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
