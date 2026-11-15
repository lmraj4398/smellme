import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { reviewsApi, type ReviewRow, type ReviewStatus } from '@/api/reviews.api';
import { Badge, Empty, PageHeader } from '@/components/ui/bits';
import { Pagination } from '@/components/ui/Pagination';
import { Stars } from '@/components/ui/Stars';
import { apiErrorMessage } from '@/lib/api-error';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { ListCard } from '@/components/ui/ListCard';
import { PillTabs } from '@/components/ui/PillTabs';

type Filter = 'all' | ReviewStatus;
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'published', label: 'Showing' }, { id: 'hidden', label: 'Hidden' }];
const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export default function ReviewsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['reviews', filter, page],
    queryFn: () => reviewsApi.list({ status: filter === 'all' ? undefined : filter, page }),
    placeholderData: keepPreviousData,
  });
  const set = useMutation({
    mutationFn: (v: { id: string; status: ReviewStatus }) => reviewsApi.setStatus(v.id, v.status),
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: ['reviews'] }); toast.success(v.status === 'hidden' ? 'Review hidden from the shop' : 'Review is showing again'); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Reviews come from customers whose order was delivered, and appear on the shop straight away. Hide one that is rude, spam or wrong." />
      <PillTabs
        label="Review status" value={filter} onChange={(f) => { setFilter(f); setPage(1); }}
        items={FILTERS.map((f) => ({ id: f.id, label: `${f.label}${f.id === 'hidden' && q.data?.hidden ? ` (${q.data.hidden})` : ''}` }))}
      />

      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} />
      {q.data?.items.length === 0 && <Empty>{filter === 'hidden' ? 'Nothing is hidden.' : 'No reviews yet.'}</Empty>}

      {!!q.data?.items.length && (
        <ListCard>
          {q.data.items.map((r) => <Row key={r.id} r={r} busy={set.isPending && set.variables?.id === r.id} onSet={(status) => set.mutate({ id: r.id, status })} />)}
        </ListCard>
      )}
      {q.data && <Pagination page={page} limit={q.data.limit} total={q.data.total} onPage={setPage} />}
    </div>
  );
}

function Row({ r, busy, onSet }: { r: ReviewRow; busy: boolean; onSet: (s: ReviewStatus) => void }) {
  const hidden = r.status === 'hidden';
  return (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-4">
      <div className="min-w-0 flex-1 basis-72">
        <div className="flex flex-wrap items-center gap-2">
          <Stars rating={r.rating} />
          <span className="font-medium">{r.product_name ?? 'Removed product'}</span>
          {hidden && <Badge tone="off">Hidden</Badge>}
        </div>
        {/* Rendered as text: it is untrusted input from the public. */}
        {r.title && <p className="mt-1 break-words font-medium">{r.title}</p>}
        {r.body && <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-[#4A4238]">{r.body}</p>}
        <p className="mt-1.5 text-xs text-taupe">{r.customer_name || 'No name'} · {r.customer_phone} · {when(r.created_at)}</p>
      </div>
      <button className="btn-secondary !min-h-10 shrink-0" disabled={busy} onClick={() => onSet(hidden ? 'published' : 'hidden')}>
        {hidden ? <><Eye size={16} aria-hidden /> Show again</> : <><EyeOff size={16} aria-hidden /> Hide</>}
      </button>
    </li>
  );
}
