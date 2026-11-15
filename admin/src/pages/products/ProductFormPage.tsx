import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { CONCENTRATIONS, GENDERS, TIERS, catalogApi, type Tier } from '@/api/catalog.api';
import { Bottle, PageHeader } from '@/components/ui/bits';
import { Card, Field } from '@/components/ui/Field';
import { PageLoader } from '@/components/ui/PageLoader';
import { Switch } from '@/components/ui/Switch';
import { apiErrorMessage } from '@/lib/api-error';
import { slugify } from '@/lib/slug';
import { MediaUploader } from './MediaUploader';
import {
  defaultSizeIndex, emptyProduct, fromProduct, moveItem, newVariant, toPayload, validateProduct, type FormErrors, type ProductFormValues, type VariantForm,
} from './product-form';

const LEVELS = [1, 2, 3, 4, 5];
const METERS = [
  { key: 'longevity', label: 'Longevity', lo: 'Brief', hi: 'All day', ph: 'e.g. 8–10 hours' },
  { key: 'projection', label: 'Projection', lo: 'Skin close', hi: 'Fills a room', ph: 'e.g. Moderate' },
  { key: 'season', label: 'Best season', lo: 'Summer', hi: 'Winter', ph: 'e.g. Winter · Monsoon' },
  { key: 'occasion', label: 'Wear it', lo: 'Day', hi: 'Night', ph: 'e.g. Evening' },
] as const;

export default function ProductFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState<ProductFormValues>(emptyProduct);
  const [errors, setErrors] = useState<FormErrors>({});
  const [dirty, setDirty] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const brands = useQuery({ queryKey: ['brands'], queryFn: catalogApi.brands });
  const families = useQuery({ queryKey: ['families'], queryFn: catalogApi.families });
  const notes = useQuery({ queryKey: ['notes'], queryFn: catalogApi.notes });
  const product = useQuery({ queryKey: ['admin-product', id], queryFn: () => catalogApi.product(id!), enabled: !isNew });

  useEffect(() => {
    if (product.data) {
      setForm(fromProduct(product.data));
      setDirty(false);
    }
  }, [product.data]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = <K extends keyof ProductFormValues>(k: K, v: ProductFormValues[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };
  const setVariant = (i: number, patch: Partial<VariantForm>) => set('variants', form.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const err = (k: string) => errors[k];

  const save = useMutation({
    mutationFn: () => (isNew ? catalogApi.createProduct(toPayload(form)) : catalogApi.updateProduct(id!, toPayload(form))),
    onSuccess: (saved) => {
      toast.success(isNew ? 'Product created' : 'Changes saved');
      setDirty(false);
      setServerError(null);
      void qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.setQueryData(['admin-product', saved.id], saved);
      if (isNew) navigate(`/products/${saved.id}`, { replace: true });
      else setForm(fromProduct(saved));
    },
    onError: (e) => {
      const msg = apiErrorMessage(e, 'Could not save the product');
      setServerError(msg);
      toast.error(msg);
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validateProduct(form);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Please fix the highlighted fields');
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    save.mutate();
  }

  const noteName = useMemo(() => new Map((notes.data ?? []).map((n) => [n.id, n])), [notes.data]);

  if (!isNew && product.isLoading) return <PageLoader />;
  if (!isNew && product.isError) {
    return <p className="py-12 text-center text-taupe">Could not load this product. <Link to="/products" className="underline">Back to products</Link></p>;
  }

  return (
    <form onSubmit={submit} noValidate className="pb-28">
      <Link to="/products" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-taupe hover:text-ink"><ArrowLeft size={16} aria-hidden /> Products</Link>
      <PageHeader title={isNew ? 'New product' : form.name || 'Product'} subtitle={isNew ? undefined : `/product/${form.slug}`} />

      {serverError && <p role="alert" className="mb-4 rounded bg-danger/10 px-4 py-3 text-danger">{serverError}</p>}

      <div className="space-y-6">
        {/* ── Basics ── */}
        <Card title="Basics">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" error={err('name')}><input className="field" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <Field label="Web address" error={err('slug')} hint={`smellme.in/product/${form.slug || slugify(form.name) || '…'} — leave blank to generate`}>
              <input className="field" value={form.slug} placeholder={slugify(form.name)} onChange={(e) => set('slug', e.target.value)} />
            </Field>
            <Field label="Brand" error={err('brand_id')}>
              <select className="field" value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)}>
                <option value="">Choose…</option>
                {brands.data?.map((b) => <option key={b.id} value={b.id}>{b.name}{b.is_active ? '' : ' (hidden)'}</option>)}
              </select>
            </Field>
            <Field label="Scent family" error={err('family_id')}>
              <select className="field" value={form.family_id} onChange={(e) => set('family_id', e.target.value)}>
                <option value="">Choose…</option>
                {families.data?.map((f) => <option key={f.id} value={f.id}>{f.name}{f.is_active ? '' : ' (hidden)'}</option>)}
              </select>
            </Field>
            <Field label="Subtitle on the card" hint="e.g. Amber · Spicy"><input className="field" value={form.descriptors} onChange={(e) => set('descriptors', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Type"><select className="field" value={form.concentration} onChange={(e) => set('concentration', e.target.value as typeof form.concentration)}>{CONCENTRATIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
              <Field label="For"><select className="field" value={form.gender} onChange={(e) => set('gender', e.target.value as typeof form.gender)}>{GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></Field>
            </div>
            <Field label="Badge" hint="New, Bestseller, Exclusive… (optional)"><input className="field" maxLength={30} value={form.badge} onChange={(e) => set('badge', e.target.value)} /></Field>
            <Field label="Sort order" hint="Lower shows first"><input className="field" type="number" min={0} value={form.sort_order} onChange={(e) => set('sort_order', Number(e.target.value) || 0)} /></Field>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-6">
            <Bottle tint={form.tint} liquid={form.liquid} mono={form.mono} size={72} />
            <Field label="Card background"><input type="color" className="h-11 w-16 cursor-pointer rounded border border-field" value={form.tint} onChange={(e) => set('tint', e.target.value)} /></Field>
            <Field label="Liquid colour"><input type="color" className="h-11 w-16 cursor-pointer rounded border border-field" value={form.liquid} onChange={(e) => set('liquid', e.target.value)} /></Field>
            <Field label="Label letters" error={err('mono')}><input className="field !w-24" maxLength={4} value={form.mono} onChange={(e) => set('mono', e.target.value)} /></Field>
            <p className="max-w-xs text-sm text-taupe">Used for the illustrated bottle until a product has photos.</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-6">
            <Switch checked={form.is_active} onChange={(v) => set('is_active', v)} label="Show on the website" />
            <Switch checked={form.is_featured} onChange={(v) => set('is_featured', v)} label="Featured (listed first)" />
          </div>
        </Card>

        {/* ── Sizes ── */}
        <Card
          title="Sizes & prices"
          aside={<button type="button" className="btn-secondary !min-h-10" onClick={() => set('variants', [...form.variants, newVariant()])}><Plus size={16} aria-hidden /> Add size</button>}
        >
          {err('variants') && <p role="alert" className="mb-3 text-sm text-danger">{err('variants')}</p>}
          <p className="mb-2 text-sm text-taupe">Prices are in rupees, inclusive of tax. Stock for an existing size is changed from <Link to="/inventory" className="underline">Inventory</Link>, so every change is recorded.</p>
          <p className="mb-4 text-sm text-taupe">The <strong>first full-size bottle</strong> in this list is the one shown (with its price) on product cards and preselected on the product page. Use the arrows to choose which one that is.</p>
          <div className="space-y-4">
            {form.variants.map((v, i) => (
              <fieldset key={v.id ?? `new-${i}`} className={`rounded border p-3 ${v.is_active ? 'border-line' : 'border-dashed border-field opacity-70'}`}>
                <legend className="px-1 text-sm text-taupe">
                  {v.id ? (v.is_active ? 'Size' : 'Retired size') : 'New size'}
                  {i === defaultSizeIndex(form.variants) && <span className="ml-2 rounded-full bg-champagne px-2 py-0.5 text-xs font-medium text-ink">Shown on cards</span>}
                </legend>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                  <Field className="col-span-2" label="Label" error={err(`variants.${i}.label`)}><input className="field" value={v.label} onChange={(e) => setVariant(i, { label: e.target.value })} /></Field>
                  <Field label="Size (ml)" error={err(`variants.${i}.size_ml`)}><input className="field" type="number" min={1} value={v.size_ml} onChange={(e) => setVariant(i, { size_ml: Number(e.target.value) })} /></Field>
                  <Field label="Price ₹" error={err(`variants.${i}.price`)}><input className="field" inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} /></Field>
                  <Field label="MRP ₹" error={err(`variants.${i}.mrp`)} hint="optional"><input className="field" inputMode="decimal" value={v.mrp} onChange={(e) => setVariant(i, { mrp: e.target.value })} /></Field>
                  {v.id ? (
                    <div><span className="label">In stock</span><div className="flex min-h-12 items-center text-[15px]">{v.stock_now}</div></div>
                  ) : (
                    <Field label="Opening stock" error={err(`variants.${i}.stock`)}><input className="field" type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} /></Field>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-6">
                  <Switch checked={v.is_sample} onChange={(x) => setVariant(i, { is_sample: x })} label="Sample vial" />
                  <Switch checked={v.is_active} onChange={(x) => setVariant(i, { is_active: x })} label="On sale" />
                  <label className="flex items-center gap-2 text-sm">Low-stock alert at
                    <input aria-label="Low-stock alert at" className="field !min-h-10 !w-20" type="number" min={0} value={v.low_stock_at} onChange={(e) => setVariant(i, { low_stock_at: Number(e.target.value) })} />
                  </label>
                  <label className="flex items-center gap-2 text-sm">SKU
                    <input aria-label="SKU" className="field !min-h-10 !w-44" placeholder="auto" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value })} />
                  </label>
                  {err(`variants.${i}.sku`) && <span role="alert" className="text-sm text-danger">{err(`variants.${i}.sku`)}</span>}
                  <span className="ml-auto flex">
                    <button type="button" aria-label={`Move ${v.label || 'size'} up`} disabled={i === 0} className="flex h-11 w-11 items-center justify-center disabled:opacity-30" onClick={() => set('variants', moveItem(form.variants, i, -1))}><ArrowUp size={18} /></button>
                    <button type="button" aria-label={`Move ${v.label || 'size'} down`} disabled={i === form.variants.length - 1} className="flex h-11 w-11 items-center justify-center disabled:opacity-30" onClick={() => set('variants', moveItem(form.variants, i, 1))}><ArrowDown size={18} /></button>
                  </span>
                  {!v.id && form.variants.length > 1 && (
                    <button type="button" aria-label="Remove this new size" className="flex h-11 w-11 items-center justify-center text-danger" onClick={() => set('variants', form.variants.filter((_, j) => j !== i))}><Trash2 size={18} /></button>
                  )}
                </div>
              </fieldset>
            ))}
          </div>
        </Card>

        {/* ── Notes ── */}
        <Card title="Fragrance notes">
          <div className="grid gap-5 md:grid-cols-3">
            {TIERS.map((tier) => {
              const chosen = form.notes.filter((n) => n.tier === tier.value);
              const free = (notes.data ?? []).filter((n) => !chosen.some((c) => c.note_id === n.id));
              return (
                <div key={tier.value}>
                  <h3 className="font-serif text-xl">{tier.label}</h3>
                  <p className="mb-2 text-sm text-taupe">{tier.hint}</p>
                  <ul className="mb-2 flex flex-wrap gap-2">
                    {chosen.map((c) => (
                      <li key={c.note_id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pl-2 pr-1 text-sm">
                        <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: noteName.get(c.note_id)?.color }} />
                        {noteName.get(c.note_id)?.name ?? '…'}
                        <button type="button" aria-label={`Remove ${noteName.get(c.note_id)?.name}`} className="flex h-8 w-8 items-center justify-center" onClick={() => set('notes', form.notes.filter((n) => !(n.note_id === c.note_id && n.tier === tier.value)))}><X size={14} /></button>
                      </li>
                    ))}
                  </ul>
                  <select aria-label={`Add to ${tier.label}`} className="field" value="" onChange={(e) => e.target.value && set('notes', [...form.notes, { note_id: e.target.value, tier: tier.value as Tier }])}>
                    <option value="">Add a note…</option>
                    {free.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-taupe">Missing an ingredient? Add it under <Link to="/brands" className="underline">Brands, families & notes</Link>.</p>
        </Card>

        {/* ── Meters ── */}
        <Card title="Scent profile">
          <div className="grid gap-4 md:grid-cols-2">
            {METERS.map((m) => {
              const lk = `${m.key}_label` as const;
              const vk = `${m.key}_level` as const;
              return (
                <div key={m.key} className="grid grid-cols-[1fr_auto] gap-3">
                  <Field label={m.label} hint="Leave blank to hide this meter"><input className="field" placeholder={m.ph} maxLength={40} value={form[lk]} onChange={(e) => set(lk, e.target.value)} /></Field>
                  <Field label={`${m.lo} → ${m.hi}`}><select className="field" value={form[vk]} onChange={(e) => set(vk, Number(e.target.value))}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select></Field>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Copy ── */}
        <Card title="Descriptions">
          <div className="grid gap-4">
            <Field label="Short description" hint="One or two lines under the product name"><textarea className="field !py-3" rows={2} maxLength={2000} value={form.short_description} onChange={(e) => set('short_description', e.target.value)} /></Field>
            <Field label="The story"><textarea className="field !py-3" rows={4} maxLength={8000} value={form.story} onChange={(e) => set('story', e.target.value)} /></Field>
            <Field label="How to wear it"><textarea className="field !py-3" rows={3} maxLength={4000} value={form.how_to_wear} onChange={(e) => set('how_to_wear', e.target.value)} /></Field>
            <Field label="Ingredients & safety" hint="Full ingredient list, country of origin, manufacturer, batch and expiry"><textarea className="field !py-3" rows={4} maxLength={8000} value={form.ingredients} onChange={(e) => set('ingredients', e.target.value)} /></Field>
          </div>
        </Card>

        {/* ── Images ── */}
        <Card title="Images">
          <MediaUploader value={form.media} onChange={(v) => set('media', v)} />
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ivory/95 px-4 py-3 backdrop-blur md:left-64">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <span className="text-sm text-taupe" aria-live="polite">{dirty ? 'Unsaved changes' : save.isSuccess ? 'All changes saved' : ''}</span>
          <div className="flex gap-3">
            <Link to="/products" className="btn-secondary">Cancel</Link>
            <button type="submit" className="btn-primary" disabled={save.isPending || (!isNew && !dirty)}>{save.isPending ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}</button>
          </div>
        </div>
      </div>
    </form>
  );
}
