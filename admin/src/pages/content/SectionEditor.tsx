import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Data, Field, ListField, SectionSpec } from '@/api/content.api';
import { uploadImage } from '@/api/uploads.api';
import { Field as FormField } from '@/components/ui/Field';
import { apiErrorMessage } from '@/lib/api-error';
import { moveItem } from '../products/product-form';
import { emptyItem, listOf, setIn, splitEmphasis, validateDraft, type Errors } from './content-form';

interface Props {
  spec: SectionSpec;
  value: Data;
  mediaBase: string;
  saving: boolean;
  customised: boolean;
  error?: string;
  onSave: (data: Data) => void;
  onReset: () => void;
  onCancel: () => void;
}

// One editor for every section: the form is generated from the section's field spec.
export function SectionEditor({ spec, value, mediaBase, saving, customised, error, onSave, onReset, onCancel }: Props) {
  const [draft, setDraft] = useState<Data>(value);
  const [errors, setErrors] = useState<Errors>({});
  const changed = JSON.stringify(draft) !== JSON.stringify(value);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateDraft(spec.fields, draft);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Please fix the highlighted fields');
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    onSave(draft);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5 border-t border-line pt-5">
      {spec.description && <p className="text-sm text-taupe">{spec.description}</p>}
      <Fields fields={spec.fields} data={draft} path={[]} errors={errors} mediaBase={mediaBase} onChange={(p, v) => setDraft((d) => setIn(d, p, v))} />
      {error && <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {customised && (
          <button type="button" className="mr-auto text-sm text-danger underline" disabled={saving} onClick={() => confirm('Put the original wording back for this section? Your edits will be lost.') && onReset()}>
            Reset to original
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onCancel}>{changed ? 'Discard' : 'Close'}</button>
        <button type="submit" className="btn-primary" disabled={saving || !changed}>{saving ? 'Saving…' : 'Save section'}</button>
      </div>
    </form>
  );
}

interface FieldsProps {
  fields: Field[];
  data: Data;
  path: (string | number)[];
  errors: Errors;
  mediaBase: string;
  onChange: (path: (string | number)[], value: unknown) => void;
}

function Fields({ fields, data, path, errors, mediaBase, onChange }: FieldsProps) {
  return (
    <div className="space-y-4">
      {fields.map((f) => {
        const p = [...path, f.key];
        const errKey = p.join('.');
        const v = data[f.key];
        if (f.type === 'list') {
          return <ListInput key={f.key} field={f} items={listOf(v)} path={p} errors={errors} mediaBase={mediaBase} onChange={onChange} />;
        }
        if (f.type === 'text' || f.type === 'textarea') {
          const s = typeof v === 'string' ? v : '';
          const max = f.max ?? (f.type === 'text' ? 200 : 2000);
          return (
            <FormField key={f.key} label={f.label + (f.required ? ' *' : '')} error={errors[errKey]} hint={f.hint}>
              {f.type === 'textarea'
                ? <textarea className="field !py-3" rows={Math.min(8, Math.max(3, Math.ceil(s.length / 70)))} value={s} maxLength={max + 50} onChange={(e) => onChange(p, e.target.value)} />
                : <input className="field" value={s} maxLength={max + 50} onChange={(e) => onChange(p, e.target.value)} />}
            </FormField>
          );
        }
        if (f.type === 'image') {
          return <ImageInput key={f.key} label={f.label} hint={f.hint} value={typeof v === 'string' ? v : ''} mediaBase={mediaBase} error={errors[errKey]} onChange={(k) => onChange(p, k)} />;
        }
        return null;
      })}
      {fields.some((f) => f.type === 'text' && /\*[^*]+\*/.test(String(data[f.key] ?? ''))) && (
        <p className="text-xs text-taupe">Preview: {fields.filter((f) => f.type === 'text').map((f) => String(data[f.key] ?? '')).filter((s) => s.includes('*')).map((s, i) => (
          <span key={i} className="mr-3">{splitEmphasis(s).map((part, j) => (part.em ? <em key={j} className="font-serif text-antique">{part.text}</em> : <span key={j}>{part.text}</span>))}</span>
        ))}</p>
      )}
    </div>
  );
}

function ListInput({ field, items, path, errors, mediaBase, onChange }: { field: ListField; items: Data[]; path: (string | number)[]; errors: Errors; mediaBase: string; onChange: FieldsProps['onChange'] }) {
  const err = errors[path.join('.')];
  return (
    <fieldset className="rounded border border-line bg-white/60 p-3">
      <legend className="px-1 text-sm font-medium">{field.label}</legend>
      {field.hint && <p className="mb-2 text-sm text-taupe">{field.hint}</p>}
      {err && <p role="alert" className="mb-2 text-sm text-danger">{err}</p>}
      {items.length === 0 && <p className="mb-2 text-sm text-taupe">Nothing here yet.</p>}
      <ol className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="rounded border border-line bg-ivory p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-taupe">{field.itemLabel[0].toUpperCase() + field.itemLabel.slice(1)} {i + 1}</span>
              <span className="flex">
                <IconBtn label={`Move ${field.itemLabel} ${i + 1} up`} disabled={i === 0} onClick={() => onChange(path, moveItem(items, i, -1))}><ArrowUp size={16} /></IconBtn>
                <IconBtn label={`Move ${field.itemLabel} ${i + 1} down`} disabled={i === items.length - 1} onClick={() => onChange(path, moveItem(items, i, 1))}><ArrowDown size={16} /></IconBtn>
                <IconBtn label={`Remove ${field.itemLabel} ${i + 1}`} danger onClick={() => onChange(path, items.filter((_, j) => j !== i))}><Trash2 size={16} /></IconBtn>
              </span>
            </div>
            <Fields fields={field.fields} data={item} path={[...path, i]} errors={errors} mediaBase={mediaBase} onChange={onChange} />
          </li>
        ))}
      </ol>
      <button type="button" className="btn-secondary mt-3 !min-h-10" disabled={items.length >= field.max} onClick={() => onChange(path, [...items, emptyItem(field.fields)])}>
        <Plus size={16} aria-hidden /> Add {field.itemLabel}
      </button>
      {items.length >= field.max && <span className="ml-3 text-sm text-taupe">Up to {field.max}</span>}
    </fieldset>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`flex h-10 w-10 items-center justify-center disabled:opacity-30 ${danger ? 'text-danger' : ''}`}>{children}</button>
  );
}

function ImageInput({ label, hint, value, mediaBase, error, onChange }: { label: string; hint?: string; value: string; mediaBase: string; error?: string; onChange: (key: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      onChange((await uploadImage(file)).key);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Upload failed'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        {value ? <img src={`${mediaBase}/${value}`} alt="" className="h-20 w-16 rounded border border-line object-cover" /> : <span className="flex h-20 w-16 items-center justify-center rounded border border-dashed border-field text-xs text-taupe">None</span>}
        <label className="btn-secondary !min-h-10 cursor-pointer">
          <ImagePlus size={16} aria-hidden /> {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          <input type="file" hidden aria-label={`Upload ${label}`} accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        {value && <button type="button" aria-label={`Remove ${label}`} className="flex h-10 w-10 items-center justify-center text-danger" onClick={() => onChange('')}><X size={18} /></button>}
      </div>
      {(error || hint) && <p className={`mt-1 text-sm ${error ? 'text-danger' : 'text-taupe'}`} role={error ? 'alert' : undefined}>{error ?? hint}</p>}
    </div>
  );
}
