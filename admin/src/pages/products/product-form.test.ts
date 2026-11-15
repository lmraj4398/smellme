import type { ProductDetail } from '@/api/catalog.api';
import { defaultSizeIndex, emptyProduct, fromProduct, moveItem, newVariant, toPayload, validateProduct, type ProductFormValues } from './product-form';

const valid = (over: Partial<ProductFormValues> = {}): ProductFormValues => ({
  ...emptyProduct(), name: 'Saffron Dusk', brand_id: 'b1', family_id: 'f1',
  variants: [newVariant({ label: '50 ml', price: '2850' })], ...over,
});

describe('validateProduct', () => {
  it('accepts a complete product', () => expect(validateProduct(valid())).toEqual({}));

  it('requires name, brand and family', () => {
    const e = validateProduct(valid({ name: '  ', brand_id: '', family_id: '' }));
    expect(Object.keys(e).sort()).toEqual(['brand_id', 'family_id', 'name']);
  });

  it('requires an active size on an active product, but not on a draft', () => {
    const none = valid({ variants: [newVariant({ label: 'x', price: '1', is_active: false })] });
    expect(validateProduct(none).variants).toMatch(/at least one active size/);
    expect(validateProduct({ ...none, is_active: false }).variants).toBeUndefined();
  });

  it.each([['', 'empty'], ['abc', 'letters'], ['-5', 'negative'], ['12.345', '3 decimals']])('rejects price %j (%s)', (price) => {
    expect(validateProduct(valid({ variants: [newVariant({ label: 'x', price })] }))['variants.0.price']).toBeTruthy();
  });

  it('rejects an MRP below the price', () => {
    const e = validateProduct(valid({ variants: [newVariant({ label: 'x', price: '3000', mrp: '2500' })] }));
    expect(e['variants.0.mrp']).toMatch(/below/);
  });

  it('flags duplicate SKUs and bad slugs', () => {
    const e = validateProduct(valid({ slug: 'Bad Slug', variants: [newVariant({ label: 'a', price: '1', sku: 'X' }), newVariant({ label: 'b', price: '1', sku: 'X' })] }));
    expect(e.slug).toBeTruthy();
    expect(e['variants.1.sku']).toMatch(/Duplicate/);
  });
});

describe('toPayload', () => {
  it('converts rupees to exact paise and trims text', () => {
    const p = toPayload(valid({ name: ' Saffron Dusk ', mono: 'sd', variants: [newVariant({ label: ' 50 ml ', price: '2,850.50', mrp: '3100' })] }));
    expect(p.name).toBe('Saffron Dusk');
    expect(p.mono).toBe('SD');
    expect(p.variants[0]).toMatchObject({ label: '50 ml', price_paise: 285050, mrp_paise: 310000 });
  });

  it('omits slug and SKU when blank so the server derives them; null MRP when blank', () => {
    const p = toPayload(valid());
    expect(p).not.toHaveProperty('slug');
    expect(p.variants[0]).not.toHaveProperty('sku');
    expect(p.variants[0].mrp_paise).toBeNull();
  });

  it('sends opening stock only for NEW sizes', () => {
    const p = toPayload(valid({ variants: [newVariant({ label: 'new', price: '1', stock: 12 }), newVariant({ id: 'v1', label: 'old', price: '1', stock: 99 })] }));
    expect(p.variants[0].stock).toBe(12);
    expect(p.variants[1]).not.toHaveProperty('stock');
    expect(p.variants[1].id).toBe('v1');
  });

  it('keeps size order as sort_order and strips media preview urls', () => {
    const p = toPayload(valid({ variants: [newVariant({ label: 'a', price: '1' }), newVariant({ label: 'b', price: '1' })], media: [{ key: 'media/x.webp', alt: 'A', url: 'https://cdn/x' }] }));
    expect(p.variants.map((v) => v.sort_order)).toEqual([0, 1]);
    expect(p.media).toEqual([{ key: 'media/x.webp', alt: 'A' }]);
  });
});

describe('fromProduct -> toPayload round trip', () => {
  const api: ProductDetail = {
    id: 'p1', slug: 'saffron-dusk', name: 'Saffron Dusk', brand_id: 'b1', family_id: 'f1', descriptors: 'Amber · Spicy',
    concentration: 'edp', gender: 'unisex', short_description: 's', story: '', how_to_wear: '', ingredients: '', badge: 'New',
    tint: '#F3E6D6', liquid: '#D7A260', mono: 'SD', longevity_label: '8–10 hours', longevity_level: 4, projection_label: '', projection_level: 3,
    season_label: '', season_level: 3, occasion_label: '', occasion_level: 3, is_active: true, is_featured: true, sort_order: 2,
    variants: [{ id: 'v1', sku: 'sd-50', label: '50 ml', size_ml: 50, price_paise: 285050, mrp_paise: null, is_sample: false, stock: 10, low_stock_at: 5, is_active: true, sort_order: 0 }],
    notes: [{ note_id: 'n1', tier: 'top' }], media: [{ key: 'media/a.webp', alt: '', url: 'https://cdn/a' }],
  };

  it('loads existing sizes with price in rupees and read-only current stock', () => {
    const f = fromProduct(api);
    expect(f.variants[0]).toMatchObject({ id: 'v1', price: '2850.5', stock_now: 10 });
  });

  it('re-saves an unchanged product to the same prices, ids and notes', () => {
    const p = toPayload(fromProduct(api));
    expect(p.variants[0]).toMatchObject({ id: 'v1', sku: 'sd-50', price_paise: 285050, mrp_paise: null });
    expect(p.notes).toEqual(api.notes);
    expect(p.slug).toBe('saffron-dusk');
    expect(p.variants[0]).not.toHaveProperty('stock');
  });
});

describe('defaultSizeIndex', () => {
  const v = (label: string, o: object = {}) => newVariant({ label, price: '1', ...o });
  it('is the first full-size bottle, skipping samples', () => {
    expect(defaultSizeIndex([v('2', { is_sample: true }), v('100'), v('10'), v('50')])).toBe(1);
  });
  it('skips retired sizes', () => expect(defaultSizeIndex([v('a', { is_active: false }), v('b')])).toBe(1));
  it('falls back to the first active sample when there is no full size', () => {
    expect(defaultSizeIndex([v('s1', { is_sample: true, is_active: false }), v('s2', { is_sample: true })])).toBe(1);
  });
  it('is -1 with nothing active', () => expect(defaultSizeIndex([v('a', { is_active: false })])).toBe(-1));
});

describe('moveItem', () => {
  it('moves up and down', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b']);
  });
  it('does nothing past either end, and never mutates', () => {
    const l = ['a', 'b'];
    expect(moveItem(l, 0, -1)).toBe(l);
    expect(moveItem(l, 1, 1)).toBe(l);
    moveItem(l, 0, 1);
    expect(l).toEqual(['a', 'b']);
  });
});
