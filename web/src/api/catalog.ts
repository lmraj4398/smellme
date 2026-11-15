import { api } from './client';

export interface ProductCardData {
  id: string; slug: string; name: string;
  brand: { name: string; slug: string; is_original: boolean };
  family: { name: string; slug: string };
  descriptors: string; concentration: string; concentration_label: string; gender: string;
  /** e.g. "Eau de Parfum · 50 ml" - the default size. */
  size_label: string;
  /** The default size: what "Add to bag" on a card adds. Null only if nothing is on sale. */
  default_variant: { id: string; label: string; in_stock: boolean } | null;
  /** Integer paise of the default size. */
  price_paise: number; mrp_paise: number | null;
  has_sample: boolean; in_stock: boolean; badge: string;
  tint: string; liquid: string; mono: string; image: string | null;
}

export interface VariantData {
  id: string; sku: string; label: string; size_ml: number; price_paise: number; mrp_paise: number | null;
  is_sample: boolean; is_default: boolean; in_stock: boolean; low_stock: boolean;
}

export interface ProductDetailData extends ProductCardData {
  short_description: string; story: string; how_to_wear: string; ingredients: string;
  variants: VariantData[];
  notes: { tier: 'top' | 'heart' | 'base'; items: { name: string; color: string }[] }[];
  meters: { key: string; label: string; level: number }[];
  media: { url: string; alt: string }[];
  related: ProductCardData[];
}

export interface ProductPage { total: number; page: number; limit: number; items: ProductCardData[] }

export interface FilterOptions {
  families: { slug: string; name: string; tint: string; count: number }[];
  brands: { slug: string; name: string; is_original: boolean; count: number }[];
  genders: { value: string; count: number }[];
  concentrations: { value: string; label: string; count: number }[];
  price_paise: { min: number; max: number };
}

export interface FamilyData { id: string; name: string; slug: string; tint: string; ink: string; notes_hint: string }
export interface BrandData { id: string; name: string; slug: string; is_original: boolean }

/** Query string the API understands. Empty values are dropped. */
export interface ProductQuery {
  q?: string; family?: string[]; brand?: string[]; gender?: string[]; concentration?: string[];
  price_min?: number; price_max?: number; sample?: boolean; sort?: 'pop' | 'new' | 'low' | 'high'; page?: number; limit?: number;
}

export function toSearchParams(q: ProductQuery): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0)) continue;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return p;
}

export const catalogApi = {
  products: (q: ProductQuery) => api.get<ProductPage>(`/products?${toSearchParams(q)}`).then((r) => r.data),
  product: (slug: string) => api.get<ProductDetailData>(`/products/${encodeURIComponent(slug)}`).then((r) => r.data),
  filters: () => api.get<FilterOptions>('/products/filters').then((r) => r.data),
  families: () => api.get<FamilyData[]>('/families').then((r) => r.data),
  brands: () => api.get<BrandData[]>('/brands').then((r) => r.data),
};
