import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadImage } from '@/api/uploads.api';
import { apiErrorMessage } from '@/lib/api-error';

export interface MediaItem { key: string; alt: string; url: string }
const MAX = 10;

export function MediaUploader({ value, onChange }: { value: MediaItem[]; onChange: (v: MediaItem[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX - value.length;
    const picked = Array.from(files).slice(0, room);
    if (files.length > room) toast.warning(`Only ${MAX} images per product; added the first ${room}.`);
    setBusy((n) => n + picked.length);
    const added: MediaItem[] = [];
    // Sequential: keeps order predictable and avoids hammering the presign rate limit.
    for (const f of picked) {
      try {
        const up = await uploadImage(f);
        added.push({ key: up.key, alt: '', url: up.url });
      } catch (e) {
        toast.error(`${f.name}: ${apiErrorMessage(e, 'upload failed')}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added]);
    if (input.current) input.current.value = '';
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {value.map((m, i) => (
          <li key={m.key} className="flex flex-col gap-2 rounded border border-line bg-white p-2">
            <img src={m.url} alt={m.alt || 'Product image'} className="aspect-[4/5] w-full rounded object-cover" />
            {i === 0 && <span className="text-xs font-medium text-antique">Main image</span>}
            <input
              aria-label={`Description of image ${i + 1}`} placeholder="Describe the image" value={m.alt} maxLength={140}
              onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
              className="field !min-h-10 !px-2 text-sm"
            />
            <div className="flex justify-between">
              <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-10 w-10 items-center justify-center disabled:opacity-30"><ArrowLeft size={16} /></button>
              <button type="button" aria-label="Remove image" onClick={() => onChange(value.filter((_, j) => j !== i))} className="flex h-10 w-10 items-center justify-center text-danger"><Trash2 size={16} /></button>
              <button type="button" aria-label="Move later" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="flex h-10 w-10 items-center justify-center disabled:opacity-30"><ArrowRight size={16} /></button>
            </div>
          </li>
        ))}
        {value.length < MAX && (
          <li>
            <button
              type="button" onClick={() => input.current?.click()} disabled={busy > 0}
              className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded border border-dashed border-field text-sm text-taupe hover:bg-pearl disabled:opacity-60"
            >
              <ImagePlus size={22} aria-hidden />
              {busy > 0 ? `Uploading ${busy}…` : 'Add images'}
            </button>
          </li>
        )}
      </ul>
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" hidden aria-label="Choose images" onChange={(e) => void add(e.target.files)} />
      <p className="mt-2 text-sm text-taupe">JPEG, PNG, WebP or AVIF. Large photos are shrunk automatically. The first image is the main one; without any, the illustrated bottle is shown.</p>
    </div>
  );
}
