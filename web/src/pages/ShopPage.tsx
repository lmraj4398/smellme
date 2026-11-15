import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { catalogApi, type FilterOptions } from '@/api/catalog';
import { Container, ErrorState, Skeleton } from '@/components/ui/States';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePageTitle } from '@/hooks/usePageTitle';
import { activeCount, EMPTY_FILTERS, filtersToParams, parseFilters, PRICE_BANDS, SORTS, toApiQuery, toggleIn, type ShopFilters } from '@/lib/shop-query';
import { cn } from '@/lib/utils';
import { ProductGrid } from '@/components/ProductGrid';

const LIMIT = 12;
const GENDER_LABEL: Record<string, string> = { women: 'Women', men: 'Men', unisex: 'Unisex' };

export default function ShopPage() {
  usePageTitle('All fragrances', 'Perfumes, attars and body mists from SmellMe Originals and the houses we carry. Every one is available as a 2 ml sample.');
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => parseFilters(params), [params]);
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [panelOpen, setPanelOpen] = useState(true); // desktop sidebar
  const [sheetOpen, setSheetOpen] = useState(false); // mobile sheet
  const [search, setSearch] = useState(filters.q);

  const set = (next: ShopFilters) => setParams(filtersToParams(next), { replace: true });
  const clear = () => { setSearch(''); set(EMPTY_FILTERS); };

  // Typing in the search box updates the URL after a short pause (not on every keystroke).
  useEffect(() => {
    if (search.trim() === filters.q.trim()) return;
    const t = setTimeout(() => set({ ...filters, q: search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
  // Back/forward or "clear" changed the URL: keep the box in step.
  useEffect(() => {
    setSearch(filters.q);
  }, [filters.q]);

  const options = useQuery({ queryKey: ['filters'], queryFn: catalogApi.filters, staleTime: 60_000 });
  const results = useInfiniteQuery({
    queryKey: ['shop', filters],
    queryFn: ({ pageParam }) => catalogApi.products(toApiQuery(filters, pageParam, LIMIT)),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.limit < last.total ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });

  const items = results.data?.pages.flatMap((p) => p.items) ?? [];
  const total = results.data?.pages[0]?.total ?? 0;
  const active = activeCount(filters);

  const panel = <FilterPanel options={options.data} filters={filters} onChange={set} />;

  return (
    <div>
      <section className="bg-[radial-gradient(ellipse_50%_90%_at_80%_0%,#fff_0%,#F4EEE4_70%)]">
        <Container className="flex flex-wrap items-end justify-between gap-x-5 gap-y-4 pb-10 pt-12">
          <h1 className="font-serif text-[clamp(44px,5vw,72px)] font-normal leading-none">All fragrances</h1>
          <p className="max-w-[460px] text-base leading-[1.65] text-taupe">Perfumes, attars and body mists from our own line and the houses we carry. Every one is available as a 2 ml sample.</p>
        </Container>
      </section>

      <Container className="flex flex-wrap items-start gap-x-12 gap-y-8 pb-24">
        <div className="sticky top-[61px] z-20 flex flex-[1_1_100%] flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-ivory py-3 md:top-0">
          <button
            type="button" aria-expanded={isMobile ? sheetOpen : panelOpen}
            onClick={() => (isMobile ? setSheetOpen(true) : setPanelOpen((o) => !o))}
            className="flex min-h-11 flex-none items-center gap-2 rounded-full border border-ink bg-white px-4 text-[13px] uppercase tracking-[0.12em]"
          >
            <SlidersHorizontal size={18} strokeWidth={1.5} aria-hidden /> Filter
            {active > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-antique px-1 text-[11px] tracking-normal text-white">{active}</span>}
          </button>
          <label className="min-w-[160px] flex-[1_1_200px]">
            <span className="sr-only">Search fragrances</span>
            <input type="search" placeholder="Search by name, brand or family" value={search} onChange={(e) => setSearch(e.target.value)} className="field !min-h-11 !rounded-full" />
          </label>
          <span aria-live="polite" className="whitespace-nowrap text-sm text-taupe">{results.isPending ? ' ' : `${total} ${total === 1 ? 'result' : 'results'}`}</span>
          <label className="ml-auto flex items-center gap-2.5 text-sm text-taupe">
            <span className="hidden md:inline">Sort by</span>
            <select aria-label="Sort by" value={filters.sort} onChange={(e) => set({ ...filters, sort: e.target.value as ShopFilters['sort'] })} className="min-h-11 max-w-[140px] rounded-full border border-field bg-white px-3 text-sm text-ink md:max-w-none md:px-4">
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={clear} disabled={!active} className={cn('min-h-11 whitespace-nowrap px-1 text-[13px] underline', active ? 'text-antique' : 'text-[#A89C8A]')}>Clear all</button>
        </div>

        {!isMobile && panelOpen && <aside aria-label="Filters" className="flex max-w-[280px] flex-[1_1_240px] flex-col">{panel}</aside>}

        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7">
          {results.isError && <ErrorState onRetry={() => void results.refetch()} />}

          {results.isPending && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 md:grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] md:gap-x-6 md:gap-y-11">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="aspect-[4/6]" />)}
            </div>
          )}

          {results.data && items.length > 0 && (
            <ProductGrid products={items} layout="catalog" className={results.isPlaceholderData ? 'opacity-60' : undefined} />
          )}

          {results.data && items.length === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-field px-4 py-16 text-center">
              <span className="font-serif text-3xl">No fragrances match these filters</span>
              <button onClick={clear} className="btn-secondary">Clear filters</button>
            </div>
          )}

          <Link to="/scent-finder" className="flex flex-wrap items-center justify-between gap-5 rounded bg-[#F1E5D1] p-8">
            <span className="font-serif text-3xl leading-[1.15]">Too many choices? Let the scent finder narrow it to three.</span>
            <span className="border-b border-ink pb-0.5 text-[13px] uppercase tracking-[0.16em]">Start the quiz →</span>
          </Link>

          {results.data && items.length > 0 && (
            <div className="flex flex-col items-center gap-3.5 pt-4">
              <span className="text-[13px] text-taupe">You’ve seen {items.length} of {total}</span>
              {results.hasNextPage && (
                <button className="btn-secondary min-h-[52px] px-9" disabled={results.isFetchingNextPage} onClick={() => void results.fetchNextPage()}>
                  {results.isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      </Container>

      {isMobile && sheetOpen && (
        <div className="fixed inset-0 z-[200] flex flex-col justify-end">
          <button aria-label="Close filters" onClick={() => setSheetOpen(false)} className="absolute inset-0 bg-ink/45" />
          <div role="dialog" aria-modal="true" aria-label="Filters" className="relative flex max-h-[86vh] flex-col rounded-t-[20px] bg-ivory shadow-[0_-12px_40px_rgba(31,27,22,0.2)]">
            <div className="flex items-center justify-between border-b border-line py-1 pl-5 pr-3">
              <span className="font-serif text-3xl">Filters</span>
              <button aria-label="Close filters" onClick={() => setSheetOpen(false)} className="flex h-11 w-11 items-center justify-center"><X size={22} strokeWidth={1.4} /></button>
            </div>
            <div className="overflow-y-auto px-5 pb-3">{panel}</div>
            <div className="flex gap-3 border-t border-line px-5 pb-[18px] pt-3.5">
              <button onClick={clear} className="btn-secondary min-h-[52px] flex-1">Clear all</button>
              <button onClick={() => setSheetOpen(false)} className="btn-primary min-h-[52px] flex-[1.6]">Show {total} results</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPanel({ options, filters, onChange }: { options?: FilterOptions; filters: ShopFilters; onChange: (f: ShopFilters) => void }) {
  if (!options) return <div className="space-y-3 py-4"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>;

  const group = (title: string, count: number, open: boolean, body: React.ReactNode) => (
    <details open={open || count > 0} className="border-b border-line py-1">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between text-[15px] font-medium [&::-webkit-details-marker]:hidden">
        {title}<span aria-hidden className="text-[13px] font-normal text-antique">{count ? `${count} selected` : '+'}</span>
      </summary>
      <div className="flex flex-col gap-0.5 pb-3.5">{body}</div>
    </details>
  );
  const check = (label: string, on: boolean, toggle: () => void, n?: number) => (
    <label key={label} className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
      <input type="checkbox" checked={on} onChange={toggle} />
      <span className="flex-1">{label}</span>
      {n !== undefined && <span className="text-xs text-taupe">{n}</span>}
    </label>
  );

  return (
    <>
      {group('Scent family', filters.family.length, true, options.families.map((f) => check(f.name, filters.family.includes(f.slug), () => onChange({ ...filters, family: toggleIn(filters.family, f.slug) }), f.count)))}
      {group('For', filters.gender.length, true, options.genders.map((g) => check(GENDER_LABEL[g.value] ?? g.value, filters.gender.includes(g.value), () => onChange({ ...filters, gender: toggleIn(filters.gender, g.value) }), g.count)))}
      {group('Price', filters.band ? 1 : 0, true, PRICE_BANDS.map((b) => (
        <label key={b.id} className="flex min-h-9 cursor-pointer items-center gap-3 text-[15px]">
          <input type="radio" name="price" checked={filters.band === b.id} onChange={() => onChange({ ...filters, band: b.id })} onClick={() => filters.band === b.id && onChange({ ...filters, band: null })} />
          {b.label}
        </label>
      )))}
      {group('Type', filters.concentration.length, false, options.concentrations.map((c) => check(c.label, filters.concentration.includes(c.value), () => onChange({ ...filters, concentration: toggleIn(filters.concentration, c.value) }), c.count)))}
      {group('Brand', filters.brand.length, false, options.brands.map((b) => check(b.name, filters.brand.includes(b.slug), () => onChange({ ...filters, brand: toggleIn(filters.brand, b.slug) }), b.count)))}
      <div className="py-2">{check('Available as a 2 ml sample', filters.sample, () => onChange({ ...filters, sample: !filters.sample }))}</div>
    </>
  );
}
