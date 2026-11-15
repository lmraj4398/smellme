import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, PackagePlus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { MANUAL_REASONS, inventoryApi, type StockRow } from '@/api/inventory.api';
import { Badge, Empty, PageHeader, useDebounced } from '@/components/ui/bits';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { apiErrorMessage } from '@/lib/api-error';
import { ListCard } from '@/components/ui/ListCard';
import { QueryStatus } from '@/components/ui/QueryStatus';

const LIMIT = 30;

export default function InventoryPage() {
  const [search, setSearch] = useState('');
  const [low, setLow] = useState(false);
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);
  const [history, setHistory] = useState<StockRow | null>(null);
  const q = useDebounced(search.trim());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['inventory', q, low, page],
    queryFn: () => inventoryApi.list({ q: q || undefined, low, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Every change is written to a ledger with who did it and why. Sales will deduct stock automatically." />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={18} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-taupe" />
          <input type="search" aria-label="Search inventory" placeholder="Search product, brand or SKU" className="field pl-11" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <label className="flex min-h-11 items-center gap-2 text-[15px]">
          <input type="checkbox" checked={low} onChange={(e) => { setLow(e.target.checked); setPage(1); }} /> Low stock only
        </label>
      </div>

      <QueryStatus isLoading={isLoading} isError={isError} onRetry={() => void refetch()} what="stock" />
      {data?.items.length === 0 && <Empty>{low ? 'Nothing is running low.' : 'No sizes found.'}</Empty>}

      {!!data?.items.length && (
        <ListCard>
          {data.items.map((r) => {
            const out = r.stock <= 0;
            const lowStock = !out && r.stock <= r.low_stock_at;
            return (
              <li key={r.variant_id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="font-medium">{r.product_name} <span className="font-normal text-taupe">· {r.label}</span></div>
                  <div className="text-sm text-taupe">{r.brand} · {r.sku}</div>
                  <div className="mt-1 flex gap-1.5">
                    {!r.product_active && <Badge tone="off">Product hidden</Badge>}
                    {!r.is_active && <Badge tone="off">Size retired</Badge>}
                  </div>
                </div>
                <div className="w-24 text-right">
                  <div className={`font-serif text-3xl leading-none ${out ? 'text-danger' : ''}`}>{r.stock}</div>
                  {out && r.is_active && <Badge tone="warn">Out of stock</Badge>}
                  {lowStock && <Badge tone="warn">Low</Badge>}
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary !min-h-10 !px-4" onClick={() => setAdjusting(r)}><PackagePlus size={16} aria-hidden /> Adjust</button>
                  <button aria-label={`History for ${r.product_name} ${r.label}`} className="flex h-10 w-10 items-center justify-center rounded-full border border-field" onClick={() => setHistory(r)}><History size={16} /></button>
                </div>
              </li>
            );
          })}
        </ListCard>
      )}
      {data && <Pagination page={page} limit={LIMIT} total={data.total} onPage={setPage} />}

      {adjusting && <AdjustModal row={adjusting} onClose={() => setAdjusting(null)} />}
      {history && <HistoryModal row={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function AdjustModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'add' | 'remove'>('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<string>('purchase');
  const [note, setNote] = useState('');

  const n = Number(qty);
  const valid = Number.isInteger(n) && n > 0;
  const delta = mode === 'add' ? n : -n;
  const after = row.stock + delta;
  const tooMany = valid && after < 0;

  const save = useMutation({
    mutationFn: () => inventoryApi.adjust(row.variant_id, { delta, reason, note: note.trim() || undefined }),
    onSuccess: (r) => {
      toast.success(`${row.product_name} ${row.label}: now ${r.stock} in stock`);
      void qc.invalidateQueries({ queryKey: ['inventory'] });
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
      onClose();
    },
  });

  return (
    <Modal title="Adjust stock" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid && !tooMany) save.mutate(); }} className="space-y-4">
        <p><strong>{row.product_name}</strong> · {row.label} — currently <strong>{row.stock}</strong> in stock</p>
        <div role="group" aria-label="Direction" className="grid grid-cols-2 gap-2">
          {(['add', 'remove'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={mode === m}
              onClick={() => { setMode(m); setReason(m === 'add' ? 'purchase' : 'damage'); }}
              className={`min-h-11 rounded-full border text-[15px] ${mode === m ? 'border-ink bg-ink text-ivory' : 'border-field bg-white'}`}>
              {m === 'add' ? 'Add stock' : 'Remove stock'}
            </button>
          ))}
        </div>
        <Field label="Quantity" error={tooMany ? `Only ${row.stock} in stock` : undefined}>
          <input className="field" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label="Reason">
          <select className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
            {MANUAL_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)" hint="Supplier, invoice number, what happened…"><input className="field" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {valid && !tooMany && <p className="text-sm text-taupe">After this: <strong>{after}</strong> in stock</p>}
        {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!valid || tooMany || save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ row, onClose }: { row: StockRow; onClose: () => void }) {
  const { data, isLoading, isError } = useQuery({ queryKey: ['ledger', row.variant_id], queryFn: () => inventoryApi.ledger(row.variant_id) });
  const label = Object.fromEntries([...MANUAL_REASONS.map((r) => [r.value, r.label]), ['opening', 'Opening stock'], ['sale', 'Sale']]);
  return (
    <Modal title={`${row.product_name} · ${row.label}`} onClose={onClose} wide>
      {isLoading && <p role="status" className="py-6 text-center text-taupe">Loading…</p>}
      {isError && <p className="py-6 text-center text-danger">Could not load the history.</p>}
      {data && (
        <table className="w-full text-left text-sm">
          <thead className="text-taupe"><tr><th className="py-2 font-medium">When</th><th className="font-medium">What</th><th className="text-right font-medium">Change</th><th className="text-right font-medium">Balance</th></tr></thead>
          <tbody>
            {data.items.map((l) => (
              <tr key={l.id} className="border-t border-line align-top">
                <td className="py-2 pr-2 text-taupe">{new Date(l.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="pr-2">{label[l.reason] ?? l.reason}{l.note && <div className="text-taupe">{l.note}</div>}{l.ref && <div className="text-taupe">{l.ref}</div>}</td>
                <td className={`text-right font-medium ${l.delta < 0 ? 'text-danger' : 'text-ok'}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                <td className="text-right">{l.balance_after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
