import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { commerceApi } from '@/api/commerce.api';
import { Badge, Empty, PageHeader } from '@/components/ui/bits';
import { Pagination } from '@/components/ui/Pagination';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { ListCard } from '@/components/ui/ListCard';

const EVENT: Record<string, string> = { otp: 'Sign-in code', order_placed: 'Order placed', payment_approved: 'Payment confirmed', payment_rejected: 'Payment rejected', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };
const TONE = { sent: 'ok', failed: 'warn', skipped: 'off' } as const;
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function WhatsAppLogPage() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['whatsapp', status, page], queryFn: () => commerceApi.whatsapp({ status: status || undefined, page }), placeholderData: keepPreviousData });

  return (
    <div>
      <PageHeader title="WhatsApp log" subtitle="Every message sent to customers. Numbers are masked and sign-in codes are never stored." />
      <div role="tablist" aria-label="Status" className="mb-4 flex gap-2">
        {[['', 'All'], ['failed', 'Failed'], ['skipped', 'Skipped'], ['sent', 'Sent']].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={status === v} onClick={() => { setStatus(v); setPage(1); }} className={`min-h-11 rounded-full border px-4 ${status === v ? 'border-ink bg-ink text-ivory' : 'border-field bg-white'}`}>{l}</button>
        ))}
      </div>
      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} />
      {q.data?.items.length === 0 && <Empty>No messages{status ? ` with status “${status}”` : ''} yet.</Empty>}
      {!!q.data?.items.length && (
        <ListCard>
          {q.data.items.map((m) => (
            <li key={m.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 p-4">
              <div className="min-w-0 flex-1 basis-56">
                <div className="font-medium">{EVENT[m.event] ?? m.event} <span className="font-normal text-taupe">· {m.to_masked}{m.ref ? ` · ${m.ref}` : ''}</span></div>
                {m.error && <div className="break-words text-sm text-danger">{m.error}</div>}
              </div>
              <span className="text-sm text-taupe">{when(m.created_at)}</span>
              <Badge tone={TONE[m.status]}>{m.status}</Badge>
            </li>
          ))}
        </ListCard>
      )}
      {q.data && <Pagination page={page} limit={q.data.limit} total={q.data.total} onPage={setPage} />}
    </div>
  );
}
