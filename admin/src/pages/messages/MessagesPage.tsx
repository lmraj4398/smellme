import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Mail, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { inboxApi, type Message } from '@/api/content.api';
import { Badge, Empty, PageHeader } from '@/components/ui/bits';
import { Pagination } from '@/components/ui/Pagination';
import { apiErrorMessage } from '@/lib/api-error';
import { downloadText, toCsv } from '@/lib/csv';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { ListCard } from '@/components/ui/ListCard';
import { PillTabs } from '@/components/ui/PillTabs';

type Tab = 'messages' | 'subscribers';
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
const digits = (s: string) => s.replace(/\D/g, '');

export default function MessagesPage() {
  const [tab, setTab] = useState<Tab>('messages');
  return (
    <div>
      <PageHeader title="Messages" subtitle="Questions from the Help page and email sign-ups from the newsletter box." />
      <PillTabs label="Inbox" items={[{ id: 'messages', label: 'Questions' }, { id: 'subscribers', label: 'Newsletter' }]} value={tab} onChange={setTab} />
      {tab === 'messages' ? <Questions /> : <Subscribers />}
    </div>
  );
}

function Questions() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['inbox', unreadOnly, page], queryFn: () => inboxApi.messages({ unread: unreadOnly, page }), placeholderData: keepPreviousData });
  const mark = useMutation({
    mutationFn: (v: { id: string; read: boolean }) => inboxApi.markRead(v.id, v.read),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['inbox'] }),
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
  const toggle = (m: Message) => {
    setOpenId(openId === m.id ? null : m.id);
    if (!m.is_read) mark.mutate({ id: m.id, read: true });
  };

  return (
    <div>
      <label className="mb-4 flex min-h-11 items-center gap-2 text-[15px]">
        <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
        Unread only {q.data ? <Badge tone={q.data.unread ? 'warn' : 'neutral'}>{q.data.unread} unread</Badge> : null}
      </label>

      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} />
      {q.data?.items.length === 0 && <Empty>{unreadOnly ? 'No unread messages.' : 'No messages yet.'}</Empty>}

      {!!q.data?.items.length && (
        <ListCard>
          {q.data.items.map((m) => (
            <li key={m.id}>
              <button type="button" aria-expanded={openId === m.id} onClick={() => toggle(m)} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${m.is_read ? 'bg-transparent' : 'bg-antique'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate ${m.is_read ? '' : 'font-medium'}`}>{m.name} <span className="font-normal text-taupe">· {m.topic}</span></span>
                  <span className="block truncate text-sm text-taupe">{m.message}</span>
                </span>
                <span className="shrink-0 text-xs text-taupe">{when(m.created_at)}</span>
              </button>
              {openId === m.id && (
                <div className="space-y-3 px-4 pb-4 pl-9">
                  {/* Rendered as text: it is untrusted input from the public. */}
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  <div className="flex flex-wrap gap-2">
                    {m.phone && <a className="btn-secondary !min-h-10" href={`tel:${digits(m.phone) ? '+' + digits(m.phone) : ''}`}><Phone size={16} aria-hidden /> {m.phone}</a>}
                    {m.phone && <a className="btn-secondary !min-h-10" href={`https://wa.me/${digits(m.phone)}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} aria-hidden /> WhatsApp</a>}
                    {m.email && <a className="btn-secondary !min-h-10" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.topic)}`}><Mail size={16} aria-hidden /> {m.email}</a>}
                    <button className="text-sm underline" onClick={() => mark.mutate({ id: m.id, read: false })}>Mark unread</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ListCard>
      )}
      {q.data && <Pagination page={page} limit={q.data.limit} total={q.data.total} onPage={setPage} />}
    </div>
  );
}

function Subscribers() {
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const q = useQuery({ queryKey: ['subscribers', page], queryFn: () => inboxApi.subscribers(page), placeholderData: keepPreviousData });

  async function exportAll() {
    setExporting(true);
    try {
      const rows: [string, string][] = [];
      for (let p = 1; ; p++) {
        const r = await inboxApi.subscribers(p, 500);
        rows.push(...r.items.map((s): [string, string] => [s.email, s.created_at]));
        if (rows.length >= r.total || r.items.length === 0) break;
      }
      downloadText(`smellme-newsletter-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['email', 'subscribed_at'], rows));
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not export'));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-taupe">{q.data ? `${q.data.total} subscriber${q.data.total === 1 ? '' : 's'}` : ' '}</p>
        <button className="btn-secondary" onClick={() => void exportAll()} disabled={exporting || !q.data?.total}><Download size={16} aria-hidden /> {exporting ? 'Exporting…' : 'Download CSV'}</button>
      </div>
      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} />
      {q.data?.items.length === 0 && <Empty>No sign-ups yet.</Empty>}
      {!!q.data?.items.length && (
        <ListCard>
          {q.data.items.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3"><span className="min-w-0 truncate">{s.email}</span><span className="shrink-0 text-xs text-taupe">{when(s.created_at)}</span></li>
          ))}
        </ListCard>
      )}
      {q.data && <Pagination page={page} limit={q.data.limit} total={q.data.total} onPage={setPage} />}
    </div>
  );
}
