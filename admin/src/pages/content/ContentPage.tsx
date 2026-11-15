import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { contentApi, type Data, type SectionSpec } from '@/api/content.api';
import { Badge, Empty, PageHeader } from '@/components/ui/bits';
import { apiErrorMessage } from '@/lib/api-error';
import { SectionEditor } from './SectionEditor';
import { PillTabs } from '@/components/ui/PillTabs';

const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL as string | undefined) ?? (import.meta.env.DEV ? 'http://localhost:5184' : '');
const PAGE_PATH: Record<string, string> = { home: '/', gifting: '/gifting', about: '/our-story', help: '/help', site: '/' };

interface Props {
  /** Start on this page tab. */
  initialPage?: string;
  /** Show only this section (used by the FAQ shortcut). */
  onlySection?: string;
  title?: string;
  subtitle?: string;
}

export default function ContentPage({ initialPage = 'home', onlySection, title = 'Website content', subtitle = 'Change the words and pictures on your website. Nothing is ever lost: “Reset to original” restores the first wording.' }: Props) {
  const qc = useQueryClient();
  const [page, setPage] = useState(initialPage);
  const [open, setOpen] = useState<string | null>(onlySection ?? null);

  const schema = useQuery({ queryKey: ['content-schema'], queryFn: contentApi.schema, staleTime: Infinity });
  const current = useQuery({ queryKey: ['content', page], queryFn: () => contentApi.page(page) });

  const done = (msg: string) => {
    toast.success(msg);
    void qc.invalidateQueries({ queryKey: ['content', page] });
  };
  const save = useMutation({ mutationFn: (v: { section: string; data: Data }) => contentApi.save(page, v.section, v.data), onSuccess: () => done('Saved. It’s live on the website within a minute.') });
  const reset = useMutation({ mutationFn: (section: string) => contentApi.reset(page, section), onSuccess: () => { done('Original wording restored'); setOpen(null); } });

  const pages = (schema.data?.pages ?? []).filter((p) => !onlySection || p.key === initialPage);
  const specs = new Map(schema.data?.pages.find((p) => p.key === page)?.sections.map((s) => [s.key, s]) ?? []);
  const sections = (current.data?.sections ?? []).filter((s) => !onlySection || s.key === onlySection);

  return (
    <div>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={<a className="btn-secondary" href={`${WEBSITE_URL}${PAGE_PATH[page] ?? '/'}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} aria-hidden /> View on website</a>}
      />

      {!onlySection && (
        <PillTabs label="Pages" items={pages.map((p) => ({ id: p.key, label: p.title }))} value={page} onChange={(key) => { setPage(key); setOpen(null); }} />
      )}

      {(schema.isLoading || current.isLoading) && <p role="status" className="py-12 text-center text-taupe">Loading…</p>}
      {(schema.isError || current.isError) && <Empty>Could not load. <button className="underline" onClick={() => { void schema.refetch(); void current.refetch(); }}>Try again</button></Empty>}

      {schema.data && current.data && (
        <ul className="space-y-3">
          {sections.map((s) => {
            const spec: SectionSpec | undefined = specs.get(s.key);
            if (!spec) return null;
            const isOpen = open === s.key;
            return (
              <li key={s.key} className="rounded-lg border border-line bg-white/60">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.key)} className="flex min-h-16 w-full items-center gap-3 px-4 text-left">
                  {isOpen ? <ChevronDown size={18} aria-hidden /> : <ChevronRight size={18} aria-hidden />}
                  <span className="flex-1">
                    <span className="block font-medium">{spec.title}</span>
                    {!isOpen && <span className="block max-w-xl truncate text-sm text-taupe">{summary(s.data)}</span>}
                  </span>
                  {s.customised ? <Badge tone="ok">Edited</Badge> : <Badge>Original</Badge>}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4">
                    <SectionEditor
                      key={`${page}.${s.key}.${s.updated_at}`}
                      spec={spec} value={s.data} mediaBase={schema.data.media_base} customised={s.customised}
                      saving={save.isPending || reset.isPending}
                      error={save.isError ? apiErrorMessage(save.error) : reset.isError ? apiErrorMessage(reset.error) : undefined}
                      onSave={(data) => save.mutate({ section: s.key, data })}
                      onReset={() => reset.mutate(s.key)}
                      onCancel={() => setOpen(null)}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** First bit of text in the section, as a hint of what is inside. */
function summary(data: Data): string {
  for (const v of Object.values(data)) if (typeof v === 'string' && v && !v.startsWith('media/')) return v.replace(/\*/g, '');
  return '';
}
