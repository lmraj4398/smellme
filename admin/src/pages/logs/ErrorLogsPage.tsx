import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { errorLogsApi, type ErrorGroup, type Severity } from '@/api/error-logs.api';
import { Badge, Empty, PageHeader } from '@/components/ui/bits';
import { ListCard } from '@/components/ui/ListCard';
import { Pagination } from '@/components/ui/Pagination';
import { PillTabs } from '@/components/ui/PillTabs';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { apiErrorMessage } from '@/lib/api-error';

type Filter = 'all' | Severity;
const FILTERS: { id: Filter; label: string }[] = [{ id: 'all', label: 'All' }, { id: 'error', label: 'Errors' }, { id: 'warning', label: 'Warnings' }];
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export default function ErrorLogsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['error-logs', filter, page],
    queryFn: () => errorLogsApi.groups({ severity: filter === 'all' ? undefined : filter, page }),
    placeholderData: keepPreviousData,
  });
  const clear = useMutation({
    mutationFn: (group: string) => errorLogsApi.clear(group),
    onSuccess: (r) => { void qc.invalidateQueries({ queryKey: ['error-logs'] }); setOpenKey(null); toast.success(`Cleared ${r.deleted} ${r.deleted === 1 ? 'entry' : 'entries'}`); },
    onError: (e) => toast.error(apiErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader title="Error logs" subtitle="Things that went wrong in the shop or this panel, grouped by where they happened. Entries older than 30 days are removed automatically." />
      <PillTabs label="Severity" items={FILTERS} value={filter} onChange={(f) => { setFilter(f); setPage(1); setOpenKey(null); }} />

      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} what="the logs" />
      {q.data?.items.length === 0 && <Empty>{filter === 'all' ? 'Nothing has gone wrong. 🎉' : 'Nothing here.'}</Empty>}

      {!!q.data?.items.length && (
        <ListCard>
          {q.data.items.map((g) => (
            <GroupRow key={g.group_key} g={g} open={openKey === g.group_key} onToggle={() => setOpenKey(openKey === g.group_key ? null : g.group_key)}
              onClear={() => confirm(`Clear all ${g.count} entries for ${g.group_label}?`) && clear.mutate(g.group_key)} />
          ))}
        </ListCard>
      )}
      {q.data && <Pagination page={page} limit={q.data.limit} total={q.data.total} onPage={setPage} />}
    </div>
  );
}

function GroupRow({ g, open, onToggle, onClear }: { g: ErrorGroup; open: boolean; onToggle: () => void; onClear: () => void }) {
  return (
    <li>
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-16 w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left">
        <span className="min-w-0 flex-1 basis-56">
          <span className="block truncate font-medium">{g.group_label}</span>
          <span className="block text-xs text-taupe">Last seen {when(g.last_at)}</span>
        </span>
        <Badge tone={g.has_error ? 'warn' : 'neutral'}>{g.has_error ? 'Error' : 'Warning'} {g.status_code}</Badge>
        <span aria-label={`${g.count} times`} className="min-w-8 text-right font-medium">{g.count}×</span>
      </button>
      {open && <Entries group={g.group_key} onClear={onClear} />}
    </li>
  );
}

function Entries({ group, onClear }: { group: string; onClear: () => void }) {
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ['error-log-entries', group, page], queryFn: () => errorLogsApi.entries(group, page), placeholderData: keepPreviousData });
  return (
    <div className="space-y-3 px-4 pb-4">
      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} what="the entries" />
      {q.data?.items.map((e) => (
        <article key={e.id} className="rounded border border-line bg-white p-3 text-sm">
          <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{e.method}</span><span className="break-all text-taupe">{e.url}</span><span className="text-xs text-taupe">· {e.status_code} · {when(e.created_at)}</span></p>
          {/* Rendered as text: messages and request data can contain anything a visitor sent. */}
          <p className="mt-1 whitespace-pre-wrap break-words">{e.message}</p>
          {(e.screen || e.user_type) && <p className="mt-1 text-xs text-taupe">{e.user_type ? `${e.user_type} ${e.user_id ?? ''}` : 'visitor'}{e.screen ? ` · from ${e.screen}` : ''}</p>}
          {e.request_body && <pre className="mt-2 max-h-40 overflow-auto rounded bg-pearl p-2 text-xs">{e.request_body}</pre>}
        </article>
      ))}
      {q.data && <Pagination page={page} limit={q.data.limit} total={q.data.total} onPage={setPage} />}
      <button className="btn-secondary !min-h-10" onClick={onClear}><Trash2 size={16} aria-hidden /> Clear this group</button>
    </div>
  );
}
