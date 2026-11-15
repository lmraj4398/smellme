import { api } from './client';

export const CONCENTRATIONS = [
  { value: 'extrait', label: 'Extrait de Parfum' },
  { value: 'edp', label: 'Eau de Parfum' },
  { value: 'edt', label: 'Eau de Toilette' },
  { value: 'attar', label: 'Attar' },
  { value: 'mist', label: 'Body mist' },
] as const;
export const GENDERS = [
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
  { value: 'unisex', label: 'Unisex' },
] as const;
export const TIERS = [
  { value: 'top', label: 'Top notes', hint: 'The first 15 minutes' },
  { value: 'heart', label: 'Heart notes', hint: 'The next 2–4 hours' },
  { value: 'base', label: 'Base notes', hint: 'What lingers' },
] as const;

export type Concentration = (typeof CONCENTRATIONS)[number]['value'];
export type Gender = (typeof GENDERS)[number]['value'];
export type Tier = (typeof TIERS)[number]['value'];

export interface Brand { id: string; name: string; slug: string; is_original: boolean; sort_order: number; is_active: boolean }
export interface Family { id: string; name: string; slug: string; tint: string; ink: string; notes_hint: string; sort_order: number; is_active: boolean }
export interface Note { id: string; name: string; color: string }

interface Variant {
  id: string; sku: string; label: string; size_ml: number; price_paise: number; mrp_paise: number | null;
  is_sample: boolean; stock: number; low_stock_at: number; is_active: boolean; sort_order: number;
}
export interface ProductDetail {
  id: string; slug: string; name: string; brand_id: string; family_id: string; descriptors: string;
  concentration: Concentration; gender: Gender; short_description: string; story: string; how_to_wear: string; ingredients: string;
  badge: string; tint: string; liquid: string; mono: string;
  longevity_label: string; longevity_level: number; projection_label: string; projection_level: number;
  season_label: string; season_level: number; occasion_label: string; occasion_level: number;
  is_active: boolean; is_featured: boolean; sort_order: number;
  variants: Variant[]; notes: { note_id: string; tier: Tier }[]; media: { key: string; alt: string; url: string }[];
}
export interface ProductRow {
  id: string; slug: string; name: string; brand: string; family: string; is_active: boolean; is_featured: boolean;
  badge: string; tint: string; liquid: string; mono: string; variant_count: number; min_price_paise: number | null; total_stock: number;
}
export interface Page<T> { total: number; page: number; limit: number; items: T[] }

/** Body of POST/PUT /admin/products. */
export interface ProductPayload {
  name: string; slug?: string; brand_id: string; family_id: string; descriptors: string; concentration: Concentration; gender: Gender;
  short_description: string; story: string; how_to_wear: string; ingredients: string; badge: string; tint: string; liquid: string; mono: string;
  longevity_label: string; longevity_level: number; projection_label: string; projection_level: number;
  season_label: string; season_level: number; occasion_label: string; occasion_level: number;
  is_active: boolean; is_featured: boolean; sort_order: number;
  variants: {
    id?: string; sku?: string; label: string; size_ml: number; price_paise: number; mrp_paise?: number | null;
    is_sample: boolean; stock?: number; low_stock_at: number; is_active: boolean; sort_order: number;
  }[];
  notes: { note_id: string; tier: Tier }[];
  media: { key: string; alt: string }[];
}

const qs = (o: Record<string, unknown>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && v !== null) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const catalogApi = {
  products: (q: { q?: string; active?: boolean; page?: number; limit?: number }) =>
    api.get<Page<ProductRow>>(`/admin/products${qs(q)}`).then((r) => r.data),
  product: (id: string) => api.get<ProductDetail>(`/admin/products/${id}`).then((r) => r.data),
  createProduct: (b: ProductPayload) => api.post<ProductDetail>('/admin/products', b).then((r) => r.data),
  updateProduct: (id: string, b: ProductPayload) => api.put<ProductDetail>(`/admin/products/${id}`, b).then((r) => r.data),
  setProductActive: (id: string, is_active: boolean) => api.patch(`/admin/products/${id}/active`, { is_active }).then((r) => r.data),

  brands: () => api.get<Brand[]>('/admin/brands').then((r) => r.data),
  saveBrand: (id: string | null, b: Pick<Brand, 'name' | 'is_original' | 'is_active' | 'sort_order'>) =>
    (id ? api.put<Brand>(`/admin/brands/${id}`, b) : api.post<Brand>('/admin/brands', b)).then((r) => r.data),
  deleteBrand: (id: string) => api.delete(`/admin/brands/${id}`),

  families: () => api.get<Family[]>('/admin/families').then((r) => r.data),
  saveFamily: (id: string | null, b: Pick<Family, 'name' | 'tint' | 'ink' | 'notes_hint' | 'is_active' | 'sort_order'>) =>
    (id ? api.put<Family>(`/admin/families/${id}`, b) : api.post<Family>('/admin/families', b)).then((r) => r.data),
  deleteFamily: (id: string) => api.delete(`/admin/families/${id}`),

  notes: () => api.get<Note[]>('/admin/notes').then((r) => r.data),
  saveNote: (id: string | null, b: Pick<Note, 'name' | 'color'>) =>
    (id ? api.put<Note>(`/admin/notes/${id}`, b) : api.post<Note>('/admin/notes', b)).then((r) => r.data),
  deleteNote: (id: string) => api.delete(`/admin/notes/${id}`),
};
