import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { STATUSES, ordersApi, type OrderStatus } from '@/api/orders.api';
import { Badge, Empty, PageHeader, useDebounced } from '@/components/ui/bits';
import { Pagination } from '@/components/ui/Pagination';
import { formatINR } from '@/lib/utils';
import { STATUS_LABEL, STATUS_TONE } from './order-actions';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { ListCard } from '@/components/ui/ListCard';

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

interface Props { initialStatus?: OrderStatus | ''; title?: string; subtitle?: string; fixed?: boolean }

export default function OrdersPage({ initialStatus = '', title = 'Orders', subtitle = 'Every order, newest first. Open one to verify its payment or move it along.', fixed }: Props) {
  // The dashboard links here as /orders?status=PAID; anything that isn't a real status is ignored.
  const [params] = useSearchParams();
  const fromUrl = params.get('status');
  const [status, setStatus] = useState<OrderStatus | ''>(fixed ? initialStatus : (STATUSES as readonly string[]).includes(fromUrl ?? '') ? (fromUrl as OrderStatus) : initialStatus);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  const summary = useQuery({ queryKey: ['orders-summary'], queryFn: ordersApi.summary, refetchInterval: 60_000 });
  const list = useQuery({ queryKey: ['orders', status, q, page], queryFn: () => ordersApi.list({ status: status || undefined, q: q || undefined, page }), placeholderData: keepPreviousData });
  const count = (s: OrderStatus) => summary.data?.by_status[s];

  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />

      {!fixed && (
        <div role="tablist" aria-label="Order status" className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {(['', ...STATUSES] as const).map((s) => (
            <button key={s || 'all'} role="tab" aria-selected={status === s} onClick={() => { setStatus(s); setPage(1); }}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-[14px] ${status === s ? 'border-ink bg-ink text-ivory' : 'border-field bg-white'}`}>
              {s ? STATUS_LABEL[s] : 'All'}{s && count(s) ? <span className="ml-1.5 opacity-70">{count(s)}</span> : null}
            </button>
          ))}
        </div>
      )}

      <div className="relative mb-4 max-w-xl">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-taupe" />
        <input type="search" aria-label="Search orders" placeholder="Order number, phone, name or payment reference" className="field pl-11" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      <QueryStatus isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()} what="orders" />
      {list.data?.items.length === 0 && <Empty>{status === 'PAYMENT_SUBMITTED' ? 'Nothing is waiting for verification. 🎉' : 'No orders found.'}</Empty>}

      {!!list.data?.items.length && (
        <ListCard>
          {list.data.items.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 hover:bg-pearl/60">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="font-medium">{o.order_no} <span className="font-normal text-taupe">· {o.ship_name}, {o.ship_city}</span></div>
                  <div className="text-sm text-taupe">{o.phone} · placed {when(o.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatINR(o.total_paise)}</div>
                  {o.status === 'PAYMENT_SUBMITTED' && o.paid_amount_paise !== null && o.paid_amount_paise !== o.total_paise && (
                    <div className="text-xs text-danger">Says paid {formatINR(o.paid_amount_paise)}</div>
                  )}
                </div>
                <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
              </Link>
            </li>
          ))}
        </ListCard>
      )}
      {list.data && <Pagination page={page} limit={list.data.limit} total={list.data.total} onPage={setPage} />}
    </div>
  );
}
