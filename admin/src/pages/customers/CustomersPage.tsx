import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { commerceApi } from '@/api/commerce.api';
import { Empty, PageHeader, useDebounced } from '@/components/ui/bits';
import { Pagination } from '@/components/ui/Pagination';
import { formatINR } from '@/lib/utils';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { ListCard } from '@/components/ui/ListCard';

// "21 Aug": a birthday has no year worth showing, and the owner only needs to know when to send the sample.
const birthday = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'never');

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounced(search.trim());
  const q = useQuery({ queryKey: ['customers', term, page], queryFn: () => commerceApi.customers({ q: term || undefined, page }), placeholderData: keepPreviousData });

  return (
    <div>
      <PageHeader title="Customers" subtitle="People who have signed in with WhatsApp. “Paid” counts only payments you have verified." />
      <div className="relative mb-4 max-w-xl">
        <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-taupe" />
        <input type="search" aria-label="Search customers" placeholder="Phone number, name or email" className="field pl-11" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} />
      {q.data?.items.length === 0 && <Empty>No customers found.</Empty>}
      {!!q.data?.items.length && (
        <ListCard>
          {q.data.items.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 p-4">
              <div className="min-w-0 flex-1 basis-56">
                <div className="font-medium">{c.name || 'No name yet'}</div>
                <a className="text-sm underline" href={`https://wa.me/${c.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">{c.phone}</a>
                {c.email && <span className="ml-2 break-all text-sm text-taupe">{c.email}</span>}
              </div>
              {c.birthday && <div className="text-sm text-taupe">Birthday {birthday(c.birthday)}</div>}
              <div className="text-sm text-taupe">{c.orders_count} order{c.orders_count === 1 ? '' : 's'} · paid {formatINR(c.total_spent_paise)}</div>
              <div className="text-xs text-taupe">Last seen {day(c.last_login_at)}</div>
            </li>
          ))}
        </ListCard>
      )}
      {q.data && <Pagination page={page} limit={q.data.limit} total={q.data.total} onPage={setPage} />}
    </div>
  );
}
