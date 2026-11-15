import { api } from './client';
import type { Page } from './catalog.api';

export interface StockRow {
  variant_id: string; sku: string; label: string; size_ml: number; stock: number; low_stock_at: number; is_active: boolean;
  product_id: string; product_name: string; product_active: boolean; brand: string;
}
export interface LedgerRow {
  id: string; delta: number; balance_after: number; reason: string; note: string | null; ref: string | null; created_at: string;
}
export const MANUAL_REASONS = [
  { value: 'purchase', label: 'Stock received' },
  { value: 'return', label: 'Customer return' },
  { value: 'damage', label: 'Damaged / expired' },
  { value: 'adjustment', label: 'Stock count correction' },
] as const;

export const inventoryApi = {
  list: (q: { q?: string; low?: boolean; page?: number }) => {
    const p = new URLSearchParams();
    if (q.q) p.set('q', q.q);
    if (q.low) p.set('low', 'true');
    if (q.page) p.set('page', String(q.page));
    return api.get<Page<StockRow>>(`/admin/inventory?${p}`).then((r) => r.data);
  },
  ledger: (variantId: string) => api.get<Page<LedgerRow>>(`/admin/inventory/${variantId}/ledger`).then((r) => r.data),
  adjust: (variantId: string, body: { delta: number; reason: string; note?: string }) =>
    api.post<{ stock: number }>(`/admin/inventory/${variantId}/adjust`, body).then((r) => r.data),
};
