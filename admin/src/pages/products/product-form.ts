import type { Concentration, Gender, ProductDetail, ProductPayload, Tier } from '@/api/catalog.api';
import { paiseToRupees, rupeesToPaise } from '@/lib/money';

// Everything the form edits, as plain strings/numbers. Prices are RUPEES here and PAISE on the wire.
export interface VariantForm {
  id?: string; // present = an existing size
  sku: string;
  label: string;
  size_ml: number;
  price: string;
  mrp: string;
  is_sample: boolean;
  stock: number; // opening stock; only sent for NEW sizes (existing stock is changed in Inventory)
  stock_now?: number; // existing sizes: shown read-only
  low_stock_at: number;
  is_active: boolean;
}

export interface ProductFormValues {
  name: string; slug: string; brand_id: string; family_id: string; descriptors: string;
  concentration: Concentration; gender: Gender;
  short_description: string; story: string; how_to_wear: string; ingredients: string;
  badge: string; tint: string; liquid: string; mono: string;
  longevity_label: string; longevity_level: number; projection_label: string; projection_level: number;
  season_label: string; season_level: number; occasion_label: string; occasion_level: number;
  is_active: boolean; is_featured: boolean; sort_order: number;
  variants: VariantForm[];
  notes: { note_id: string; tier: Tier }[];
  media: { key: string; alt: string; url: string }[];
}

export const newVariant = (over: Partial<VariantForm> = {}): VariantForm => ({
  sku: '', label: '', size_ml: 50, price: '', mrp: '', is_sample: false, stock: 0, low_stock_at: 5, is_active: true, ...over,
});

export const emptyProduct = (): ProductFormValues => ({
  name: '', slug: '', brand_id: '', family_id: '', descriptors: '', concentration: 'edp', gender: 'unisex',
  short_description: '', story: '', how_to_wear: 'Spray on pulse points — wrists, neck, behind the ears — after moisturising. Don’t rub; let it settle.', ingredients: '',
  badge: '', tint: '#F3E6D6', liquid: '#D7A260', mono: '',
  longevity_label: '', longevity_level: 3, projection_label: '', projection_level: 3,
  season_label: '', season_level: 3, occasion_label: '', occasion_level: 3,
  is_active: true, is_featured: false, sort_order: 0,
  variants: [newVariant({ label: '2 ml sample', size_ml: 2, is_sample: true }), newVariant({ label: '50 ml', size_ml: 50 })],
  notes: [], media: [],
});

export function fromProduct(p: ProductDetail): ProductFormValues {
  return {
    name: p.name, slug: p.slug, brand_id: p.brand_id, family_id: p.family_id, descriptors: p.descriptors,
    concentration: p.concentration, gender: p.gender, short_description: p.short_description, story: p.story,
    how_to_wear: p.how_to_wear, ingredients: p.ingredients, badge: p.badge, tint: p.tint, liquid: p.liquid, mono: p.mono,
    longevity_label: p.longevity_label, longevity_level: p.longevity_level, projection_label: p.projection_label, projection_level: p.projection_level,
    season_label: p.season_label, season_level: p.season_level, occasion_label: p.occasion_label, occasion_level: p.occasion_level,
    is_active: p.is_active, is_featured: p.is_featured, sort_order: p.sort_order,
    variants: p.variants.map((v) => ({
      id: v.id, sku: v.sku, label: v.label, size_ml: v.size_ml, price: paiseToRupees(v.price_paise), mrp: paiseToRupees(v.mrp_paise),
      is_sample: v.is_sample, stock: 0, stock_now: v.stock, low_stock_at: v.low_stock_at, is_active: v.is_active,
    })),
    notes: p.notes.map((n) => ({ note_id: n.note_id, tier: n.tier })),
    media: p.media.map((m) => ({ key: m.key, alt: m.alt, url: m.url })),
  };
}

export type FormErrors = Record<string, string>;

/** Client-side checks that mirror the API's rules, so people see the problem next to the field, not as a toast. */
export function validateProduct(v: ProductFormValues): FormErrors {
  const e: FormErrors = {};
  if (!v.name.trim()) e.name = 'Enter a name';
  if (!v.brand_id) e.brand_id = 'Choose a brand';
  if (!v.family_id) e.family_id = 'Choose a scent family';
  if (v.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.slug)) e.slug = 'Use lowercase letters, numbers and dashes';
  if (v.mono.length > 4) e.mono = 'Up to 4 characters';

  const active = v.variants.filter((x) => x.is_active);
  if (v.is_active && active.length === 0) e.variants = 'An active product needs at least one active size';

  const skus = new Set<string>();
  v.variants.forEach((x, i) => {
    if (!x.label.trim()) e[`variants.${i}.label`] = 'Enter a label';
    if (!Number.isInteger(x.size_ml) || x.size_ml < 1) e[`variants.${i}.size_ml`] = 'Whole ml, at least 1';
    const price = rupeesToPaise(x.price);
    if (price === null) e[`variants.${i}.price`] = 'Enter an amount like 2850 or 2850.50';
    if (x.mrp.trim()) {
      const mrp = rupeesToPaise(x.mrp);
      if (mrp === null) e[`variants.${i}.mrp`] = 'Enter an amount';
      else if (price !== null && mrp < price) e[`variants.${i}.mrp`] = 'MRP cannot be below the price';
    }
    if (!x.id && (!Number.isInteger(x.stock) || x.stock < 0)) e[`variants.${i}.stock`] = 'Whole number, 0 or more';
    if (x.sku.trim()) {
      if (skus.has(x.sku.trim())) e[`variants.${i}.sku`] = 'Duplicate SKU';
      skus.add(x.sku.trim());
    }
  });
  return e;
}

export function toPayload(v: ProductFormValues): ProductPayload {
  return {
    name: v.name.trim(),
    ...(v.slug.trim() ? { slug: v.slug.trim() } : {}),
    brand_id: v.brand_id, family_id: v.family_id, descriptors: v.descriptors.trim(),
    concentration: v.concentration, gender: v.gender,
    short_description: v.short_description, story: v.story, how_to_wear: v.how_to_wear, ingredients: v.ingredients,
    badge: v.badge.trim(), tint: v.tint, liquid: v.liquid, mono: v.mono.trim().toUpperCase(),
    longevity_label: v.longevity_label.trim(), longevity_level: v.longevity_level,
    projection_label: v.projection_label.trim(), projection_level: v.projection_level,
    season_label: v.season_label.trim(), season_level: v.season_level,
    occasion_label: v.occasion_label.trim(), occasion_level: v.occasion_level,
    is_active: v.is_active, is_featured: v.is_featured, sort_order: v.sort_order,
    variants: v.variants.map((x, i) => ({
      ...(x.id ? { id: x.id } : {}),
      ...(x.sku.trim() ? { sku: x.sku.trim() } : {}),
      label: x.label.trim(), size_ml: x.size_ml,
      price_paise: rupeesToPaise(x.price)!,
      mrp_paise: x.mrp.trim() ? rupeesToPaise(x.mrp) : null,
      is_sample: x.is_sample, low_stock_at: x.low_stock_at, is_active: x.is_active, sort_order: i,
      // Opening stock only for brand-new sizes. For existing ones the API ignores it anyway, and the
      // honest path (a ledger entry with a reason) is the Inventory screen.
      ...(!x.id && x.stock > 0 ? { stock: x.stock } : {}),
    })),
    notes: v.notes,
    media: v.media.map((m) => ({ key: m.key, alt: m.alt })),
  };
}

/** Index of the size that cards and the product page default to: the first active, non-sample size (else the first active one). Mirrors the API. */
export function defaultSizeIndex(variants: VariantForm[]): number {
  const full = variants.findIndex((v) => v.is_active && !v.is_sample);
  return full >= 0 ? full : variants.findIndex((v) => v.is_active);
}

/** Returns a copy with item `i` moved by `d` places (no-op at the ends). */
export function moveItem<T>(list: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
