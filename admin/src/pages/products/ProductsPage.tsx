import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { catalogApi, type ProductRow } from '@/api/catalog.api';
import { Badge, Bottle, Empty, PageHeader, useDebounced } from '@/components/ui/bits';
import { Pagination } from '@/components/ui/Pagination';
import { Switch } from '@/components/ui/Switch';
import { apiErrorMessage } from '@/lib/api-error';
import { formatINR } from '@/lib/utils';
import { ListCard } from '@/components/ui/ListCard';
import { QueryStatus } from '@/components/ui/QueryStatus';

const LIMIT = 20;

export default function ProductsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'off'>('all');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  const active = status === 'all' ? undefined : status === 'active';
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-products', q, active, page],
    queryFn: () => catalogApi.products({ q: q || undefined, active, page, limit: LIMIT }),
    placeholderData: keepPreviousData,
  });

  const toggle = useMutation({
    mutationFn: (p: ProductRow) => catalogApi.setProductActive(p.id, !p.is_active),
    onSuccess: (_d, p) => {
      toast.success(`${p.name} is now ${p.is_active ? 'hidden from' : 'visible on'} the website`);
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Fragrances shown on the website. Switch one off to hide it without deleting anything."
        actions={<Link to="/products/new" className="btn-primary"><Plus size={16} aria-hidden /> New product</Link>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-taupe" />
          <input
            type="search" aria-label="Search products" placeholder="Search by product or brand"
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="field pl-11"
          />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value as typeof status); setPage(1); }} className="field !w-auto">
          <option value="all">All</option>
          <option value="active">On the website</option>
          <option value="off">Hidden</option>
        </select>
      </div>

      <QueryStatus isLoading={isLoading} isError={isError} onRetry={() => void refetch()} what="products" />
      {data && data.items.length === 0 && (
        <Empty>{q || active !== undefined ? 'No products match.' : <>No products yet. <Link to="/products/new" className="underline">Add the first one</Link>.</>}</Empty>
      )}

      {data && data.items.length > 0 && (
        <ListCard>
          {data.items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <Bottle tint={p.tint} liquid={p.liquid} mono={p.mono} size={48} />
              <div className="min-w-0 flex-1 basis-48">
                <Link to={`/products/${p.id}`} className="font-serif text-2xl leading-tight hover:text-antique">{p.name}</Link>
                <div className="text-sm text-taupe">{p.brand} · {p.family}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {p.badge && <Badge>{p.badge}</Badge>}
                  {p.is_featured && <Badge tone="ok">Featured</Badge>}
                  {!p.is_active && <Badge tone="off">Hidden</Badge>}
                  {p.is_active && p.variant_count === 0 && <Badge tone="warn">No active sizes</Badge>}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-medium">{p.min_price_paise !== null ? `from ${formatINR(p.min_price_paise)}` : '—'}</div>
                <div className={p.total_stock === 0 ? 'text-danger' : 'text-taupe'}>{p.total_stock} in stock · {p.variant_count} sizes</div>
              </div>
              <Switch checked={p.is_active} label="On website" disabled={toggle.isPending} onChange={() => toggle.mutate(p)} />
            </li>
          ))}
        </ListCard>
      )}
      {data && <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} />}
    </div>
  );
}
