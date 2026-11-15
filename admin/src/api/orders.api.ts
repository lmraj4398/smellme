import { api } from './client';
import type { Page } from './catalog.api';

export const STATUSES = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
export type OrderStatus = (typeof STATUSES)[number];

export interface OrderRow {
  id: string; order_no: string; status: OrderStatus; total_paise: number; created_at: string; payment_submitted_at: string | null;
  paid_amount_paise: number | null; ship_name: string; ship_city: string; phone: string; customer_name: string;
}
export interface OrderSummary {
  by_status: Record<OrderStatus, number>; awaiting_verification: number; to_pack: number; to_ship: number; refunds_due: number;
  low_stock_variants: number; today: { verified_sales_paise: number; verified_orders: number };
}
export interface OrderDetail {
  id: string; order_no: string; status: OrderStatus; created_at: string;
  customer: { id: string; name: string; phone: string; email: string };
  address: { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string };
  totals: { subtotal_paise: number; discount_paise: number; delivery_fee_paise: number; gift_wrap_paise: number; total_paise: number };
  coupon_code: string | null; gift: { wrap: boolean; message: string; engraving: string };
  items: { name: string; brand: string; label: string; sku: string; qty: number; unit_price_paise: number; line_total_paise: number; is_free_sample: boolean }[];
  payment: {
    has_receipt: boolean; utr: string | null; claimed_amount_paise: number | null; expected_amount_paise: number; amount_mismatch: boolean;
    duplicate_utr_orders: { order_no: string; status: string }[]; submitted_at: string | null; verified_at: string | null; reject_reason: string | null;
  };
  shipping: { carrier: string | null; tracking_no: string | null; packed_at: string | null; shipped_at: string | null; delivered_at: string | null };
  cancel: { at: string | null; reason: string | null; by: string | null; refund_due: boolean; refunded_at: string | null; refund_note: string | null };
  events: { at: string; from: OrderStatus | null; to: OrderStatus; actor: string; note: string | null; meta: Record<string, unknown> | null }[];
}

const act = (id: string, path: string, body: object = {}) => api.post<OrderDetail>(`/admin/orders/${id}/${path}`, body).then((r) => r.data);

export const ordersApi = {
  list: (q: { status?: string; q?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (q.status) p.set('status', q.status);
    if (q.q) p.set('q', q.q);
    if (q.page) p.set('page', String(q.page));
    return api.get<Page<OrderRow>>(`/admin/orders?${p}`).then((r) => r.data);
  },
  summary: () => api.get<OrderSummary>('/admin/orders/summary').then((r) => r.data),
  detail: (id: string) => api.get<OrderDetail>(`/admin/orders/${id}`).then((r) => r.data),
  receiptUrl: (id: string) => api.get<{ url: string; expires_in: number; is_pdf: boolean }>(`/admin/orders/${id}/receipt-url`).then((r) => r.data),
  approve: (id: string, b: { confirm_amount_mismatch?: boolean; confirm_duplicate_utr?: boolean }) => act(id, 'approve-payment', b),
  reject: (id: string, reason: string) => act(id, 'reject-payment', { reason }),
  pack: (id: string) => act(id, 'pack'),
  ship: (id: string, carrier: string, tracking_no: string) => act(id, 'ship', { carrier, tracking_no }),
  deliver: (id: string) => act(id, 'deliver'),
  cancel: (id: string, reason: string) => act(id, 'cancel', { reason }),
  refund: (id: string, note: string) => act(id, 'refund', { note }),
};
