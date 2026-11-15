import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ProductCardData, ProductDetailData } from '@/api/catalog';

let lastLocation = '';
function Spy() {
  const l = useLocation();
  lastLocation = l.pathname + l.search;
  return null;
}
/** The URL (path + query) the router is currently at. */
export const currentUrl = () => lastLocation;

export function renderAt(ui: ReactElement, opts: { path?: string; route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opts.route ?? '/']}>
        <Spy />
        <Routes>
          <Route path={opts.path ?? '/'} element={ui} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const V50 = '11111111-1111-4111-8111-111111111111';
export const V100 = '22222222-2222-4222-8222-222222222222';
export const V2 = '33333333-3333-4333-8333-333333333333';

export const card = (over: Partial<ProductCardData> = {}): ProductCardData => ({
  id: 'p1', slug: 'saffron-dusk', name: 'Saffron Dusk',
  brand: { name: 'SmellMe Originals', slug: 'smellme-originals', is_original: true },
  family: { name: 'Amber', slug: 'amber' }, descriptors: 'Amber · Spicy', concentration: 'edp', concentration_label: 'Eau de Parfum', gender: 'unisex',
  size_label: 'Eau de Parfum · 50 ml', default_variant: { id: V50, label: '50 ml', in_stock: true },
  price_paise: 285000, mrp_paise: null, has_sample: true, in_stock: true, badge: 'New', tint: '#F3E6D6', liquid: '#D7A260', mono: 'SD', image: null, ...over,
});

export const detail = (over: Partial<ProductDetailData> = {}): ProductDetailData => ({
  ...card(), short_description: 'Kashmiri saffron warmed with rose.', story: 'A dusk in Srinagar.', how_to_wear: 'Spray on pulse points.', ingredients: 'Alcohol, parfum.',
  variants: [
    { id: V2, sku: 'sd-2ml', label: '2 ml sample', size_ml: 2, price_paise: 19000, mrp_paise: null, is_sample: true, is_default: false, in_stock: true, low_stock: false },
    { id: V50, sku: 'sd-50ml', label: '50 ml', size_ml: 50, price_paise: 285000, mrp_paise: 310000, is_sample: false, is_default: true, in_stock: true, low_stock: false },
    { id: V100, sku: 'sd-100ml', label: '100 ml', size_ml: 100, price_paise: 445000, mrp_paise: null, is_sample: false, is_default: false, in_stock: false, low_stock: false },
  ],
  notes: [{ tier: 'top', items: [{ name: 'Saffron', color: '#E8B46A' }] }, { tier: 'base', items: [{ name: 'Amber', color: '#D9A25B' }] }],
  meters: [{ key: 'longevity', label: '8–10 hours', level: 4 }],
  media: [], related: [card({ id: 'p2', slug: 'oud-ivoire', name: 'Oud Ivoire', price_paise: 690000, default_variant: { id: '44444444-4444-4444-8444-444444444444', label: '50 ml', in_stock: true } })], ...over,
});
