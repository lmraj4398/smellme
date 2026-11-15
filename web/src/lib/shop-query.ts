import type { ProductQuery } from '@/api/catalog';

// The Shop page keeps its whole state in the URL, so a filtered view can be shared, bookmarked,
// and survives refresh and the back button. This file is the only place that maps URL <-> filters.

export const PRICE_BANDS = [
  { id: 'u2', label: 'Under ₹2,000', max: 200000 },
  { id: 'm', label: '₹2,000 – ₹4,000', min: 200000, max: 400000 },
  { id: 'o4', label: 'Above ₹4,000', min: 400000 },
] as const;
type BandId = (typeof PRICE_BANDS)[number]['id'];

export const SORTS = [
  { value: 'pop', label: 'Popular' },
  { value: 'new', label: 'Newest' },
  { value: 'low', label: 'Price: low to high' },
  { value: 'high', label: 'Price: high to low' },
] as const;
type Sort = (typeof SORTS)[number]['value'];

export interface ShopFilters {
  q: string;
  family: string[];
  brand: string[];
  gender: string[];
  concentration: string[];
  band: BandId | null;
  sample: boolean;
  sort: Sort;
}

export const EMPTY_FILTERS: ShopFilters = { q: '', family: [], brand: [], gender: [], concentration: [], band: null, sample: false, sort: 'pop' };

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
const only = <T extends string>(v: string | null, ok: readonly T[]): T | null => (ok.includes(v as T) ? (v as T) : null);

export function parseFilters(p: URLSearchParams): ShopFilters {
  return {
    q: (p.get('q') ?? '').slice(0, 80),
    family: list(p.get('family')),
    brand: list(p.get('brand')),
    gender: list(p.get('gender')),
    concentration: list(p.get('concentration')),
    band: only(p.get('price'), PRICE_BANDS.map((b) => b.id)),
    sample: p.get('sample') === 'true',
    sort: only(p.get('sort'), SORTS.map((s) => s.value)) ?? 'pop',
  };
}

export function filtersToParams(f: ShopFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  for (const k of ['family', 'brand', 'gender', 'concentration'] as const) if (f[k].length) p.set(k, f[k].join(','));
  if (f.band) p.set('price', f.band);
  if (f.sample) p.set('sample', 'true');
  if (f.sort !== 'pop') p.set('sort', f.sort);
  return p;
}

/** Filters -> the API's query (price band becomes a paise range). */
export function toApiQuery(f: ShopFilters, page: number, limit = 12): ProductQuery {
  const band = PRICE_BANDS.find((b) => b.id === f.band);
  return {
    q: f.q.trim() || undefined,
    family: f.family, brand: f.brand, gender: f.gender, concentration: f.concentration,
    price_min: band && 'min' in band ? band.min : undefined,
    price_max: band && 'max' in band ? band.max : undefined,
    sample: f.sample || undefined,
    sort: f.sort, page, limit,
  };
}

export const activeCount = (f: ShopFilters) =>
  f.family.length + f.brand.length + f.gender.length + f.concentration.length + (f.band ? 1 : 0) + (f.sample ? 1 : 0) + (f.q.trim() ? 1 : 0);

export const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
