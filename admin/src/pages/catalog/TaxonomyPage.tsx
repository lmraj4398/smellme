import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { catalogApi, type Brand, type Family, type Note } from '@/api/catalog.api';
import { Badge, Empty, PageHeader } from '@/components/ui/bits';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { apiErrorMessage } from '@/lib/api-error';
import { ListCard } from '@/components/ui/ListCard';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { PillTabs } from '@/components/ui/PillTabs';

type Tab = 'brands' | 'families' | 'notes';
const TABS: { id: Tab; label: string }[] = [
  { id: 'brands', label: 'Brands' },
  { id: 'families', label: 'Scent families' },
  { id: 'notes', label: 'Notes' },
];

export default function TaxonomyPage() {
  const [tab, setTab] = useState<Tab>('brands');
  return (
    <div>
      <PageHeader title="Brands, families & notes" subtitle="The building blocks you pick from when adding a product." />
      <PillTabs label="Catalog lists" items={TABS} value={tab} onChange={setTab} />
      {tab === 'brands' && <BrandsTab />}
      {tab === 'families' && <FamiliesTab />}
      {tab === 'notes' && <NotesTab />}
    </div>
  );
}

// Shared list shell: loading/error/empty states, add button, row actions.
function ListShell<T extends { id: string }>({
  title, noun, query, onAdd, row,
}: {
  title: string; noun: string; query: { data?: T[]; isLoading: boolean; isError: boolean; refetch: () => unknown };
  onAdd: () => void; row: (item: T) => ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-3 flex justify-end"><button className="btn-primary" onClick={onAdd}><Plus size={16} aria-hidden /> Add {noun}</button></div>
      <QueryStatus isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
      {query.data?.length === 0 && <Empty>Nothing here yet.</Empty>}
      {!!query.data?.length && <ListCard>{query.data.map((it) => <li key={it.id} className="flex items-center gap-3 p-3">{row(it)}</li>)}</ListCard>}
    </section>
  );
}

function RowActions({ onEdit, onDelete, name }: { onEdit: () => void; onDelete: () => void; name: string }) {
  return (
    <div className="ml-auto flex shrink-0">
      <button aria-label={`Edit ${name}`} onClick={onEdit} className="flex h-11 w-11 items-center justify-center hover:text-antique"><Pencil size={18} /></button>
      <button aria-label={`Delete ${name}`} onClick={onDelete} className="flex h-11 w-11 items-center justify-center text-danger"><Trash2 size={18} /></button>
    </div>
  );
}

function useDelete(label: string, fn: (id: string) => Promise<unknown>, key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success(`${label} deleted`); void qc.invalidateQueries({ queryKey: [key] }); },
    // A 409 here means products still use it - the API's message says what to do.
    onError: (e) => toast.error(apiErrorMessage(e)),
  });
}

function useSave<V>(key: string, fn: (id: string | null, v: V) => Promise<unknown>, done: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, v }: { id: string | null; v: V }) => fn(id, v),
    onSuccess: () => { toast.success('Saved'); void qc.invalidateQueries({ queryKey: [key] }); done(); },
  });
}

function Footer({ onCancel, pending, error }: { onCancel: () => void; pending: boolean; error?: string }) {
  return (
    <>
      {error && <p role="alert" className="mr-auto self-center text-sm text-danger">{error}</p>}
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
    </>
  );
}

// ── Brands ──
function BrandsTab() {
  const q = useQuery({ queryKey: ['brands'], queryFn: catalogApi.brands });
  const [edit, setEdit] = useState<Brand | 'new' | null>(null);
  const del = useDelete('Brand', catalogApi.deleteBrand, 'brands');
  return (
    <>
      <ListShell title="Brands" noun="brand" query={q} onAdd={() => setEdit('new')} row={(b) => (
        <>
          <div>
            <div className="font-medium">{b.name}</div>
            <div className="mt-1 flex gap-1.5">{b.is_original && <Badge tone="ok">Our own line</Badge>}{!b.is_active && <Badge tone="off">Hidden</Badge>}</div>
          </div>
          <RowActions name={b.name} onEdit={() => setEdit(b)} onDelete={() => confirm(`Delete ${b.name}?`) && del.mutate(b.id)} />
        </>
      )} />
      {edit && <BrandModal item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function BrandModal({ item, onClose }: { item: Brand | null; onClose: () => void }) {
  const [v, setV] = useState({ name: item?.name ?? '', is_original: item?.is_original ?? false, is_active: item?.is_active ?? true, sort_order: item?.sort_order ?? 0 });
  const save = useSave('brands', catalogApi.saveBrand, onClose);
  return (
    <Modal title={item ? 'Edit brand' : 'Add brand'} onClose={onClose}>
      <form id="f" onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) save.mutate({ id: item?.id ?? null, v: { ...v, name: v.name.trim() } }); }} className="space-y-4">
        <Field label="Name"><input className="field" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={100} /></Field>
        <Switch checked={v.is_original} onChange={(x) => setV({ ...v, is_original: x })} label="This is our own line (SmellMe Originals)" />
        <Switch checked={v.is_active} onChange={(x) => setV({ ...v, is_active: x })} label="Visible on the website" />
        <Field label="Sort order" hint="Lower shows first"><input className="field" type="number" min={0} value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) || 0 })} /></Field>
        <div className="flex justify-end gap-3 pt-2"><Footer onCancel={onClose} pending={save.isPending} error={save.isError ? apiErrorMessage(save.error) : undefined} /></div>
      </form>
    </Modal>
  );
}

// ── Families ──
function FamiliesTab() {
  const q = useQuery({ queryKey: ['families'], queryFn: catalogApi.families });
  const [edit, setEdit] = useState<Family | 'new' | null>(null);
  const del = useDelete('Scent family', catalogApi.deleteFamily, 'families');
  return (
    <>
      <ListShell title="Scent families" noun="family" query={q} onAdd={() => setEdit('new')} row={(f) => (
        <>
          <span aria-hidden className="flex h-12 w-10 items-center justify-center rounded-t-full border border-line font-serif italic" style={{ background: f.tint, color: f.ink }}>{f.name.slice(0, 2)}</span>
          <div>
            <div className="font-medium">{f.name} {!f.is_active && <Badge tone="off">Hidden</Badge>}</div>
            <div className="text-sm text-taupe">{f.notes_hint}</div>
          </div>
          <RowActions name={f.name} onEdit={() => setEdit(f)} onDelete={() => confirm(`Delete ${f.name}?`) && del.mutate(f.id)} />
        </>
      )} />
      {edit && <FamilyModal item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function FamilyModal({ item, onClose }: { item: Family | null; onClose: () => void }) {
  const [v, setV] = useState({ name: item?.name ?? '', tint: item?.tint ?? '#F3E6D6', ink: item?.ink ?? '#9A6A2E', notes_hint: item?.notes_hint ?? '', is_active: item?.is_active ?? true, sort_order: item?.sort_order ?? 0 });
  const save = useSave('families', catalogApi.saveFamily, onClose);
  return (
    <Modal title={item ? 'Edit scent family' : 'Add scent family'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) save.mutate({ id: item?.id ?? null, v: { ...v, name: v.name.trim() } }); }} className="space-y-4">
        <Field label="Name"><input className="field" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={60} /></Field>
        <Field label="Typical notes" hint="Shown under the family on the home page, e.g. Rose, jasmine, tuberose"><input className="field" value={v.notes_hint} maxLength={120} onChange={(e) => setV({ ...v, notes_hint: e.target.value })} /></Field>
        <div className="flex items-end gap-5">
          <span aria-hidden className="flex h-20 w-16 items-center justify-center rounded-t-full border border-line font-serif text-2xl italic" style={{ background: v.tint, color: v.ink }}>{v.name.slice(0, 2) || 'Aa'}</span>
          <Field label="Background"><input type="color" className="h-11 w-16 cursor-pointer rounded border border-field" value={v.tint} onChange={(e) => setV({ ...v, tint: e.target.value })} /></Field>
          <Field label="Lettering"><input type="color" className="h-11 w-16 cursor-pointer rounded border border-field" value={v.ink} onChange={(e) => setV({ ...v, ink: e.target.value })} /></Field>
        </div>
        <Switch checked={v.is_active} onChange={(x) => setV({ ...v, is_active: x })} label="Visible on the website" />
        <Field label="Sort order"><input className="field" type="number" min={0} value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) || 0 })} /></Field>
        <div className="flex justify-end gap-3 pt-2"><Footer onCancel={onClose} pending={save.isPending} error={save.isError ? apiErrorMessage(save.error) : undefined} /></div>
      </form>
    </Modal>
  );
}

// ── Notes ──
function NotesTab() {
  const q = useQuery({ queryKey: ['notes'], queryFn: catalogApi.notes });
  const [edit, setEdit] = useState<Note | 'new' | null>(null);
  const del = useDelete('Note', catalogApi.deleteNote, 'notes');
  return (
    <>
      <ListShell title="Notes" noun="note" query={q} onAdd={() => setEdit('new')} row={(n) => (
        <>
          <span aria-hidden className="h-8 w-8 rounded-full border border-line" style={{ background: n.color }} />
          <span className="font-medium">{n.name}</span>
          <RowActions name={n.name} onEdit={() => setEdit(n)} onDelete={() => confirm(`Delete ${n.name}?`) && del.mutate(n.id)} />
        </>
      )} />
      {edit && <NoteModal item={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function NoteModal({ item, onClose }: { item: Note | null; onClose: () => void }) {
  const [v, setV] = useState({ name: item?.name ?? '', color: item?.color ?? '#E8B46A' });
  const save = useSave('notes', catalogApi.saveNote, onClose);
  return (
    <Modal title={item ? 'Edit note' : 'Add note'} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); if (v.name.trim()) save.mutate({ id: item?.id ?? null, v: { ...v, name: v.name.trim() } }); }} className="space-y-4">
        <Field label="Ingredient name"><input className="field" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required maxLength={60} /></Field>
        <Field label="Circle colour on the product page"><input type="color" className="h-11 w-16 cursor-pointer rounded border border-field" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} /></Field>
        <div className="flex justify-end gap-3 pt-2"><Footer onCancel={onClose} pending={save.isPending} error={save.isError ? apiErrorMessage(save.error) : undefined} /></div>
      </form>
    </Modal>
  );
}
