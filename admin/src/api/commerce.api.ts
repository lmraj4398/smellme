import { api } from './client';
import type { Page } from './catalog.api';

export interface Coupon {
  id: string; code: string; description: string; type: 'percent' | 'flat'; value: number; min_order_paise: number; max_discount_paise: number | null;
  starts_at: string | null; ends_at: string | null; max_uses: number | null; per_customer_limit: number; used_count: number; is_active: boolean;
}
export type CouponInput = Omit<Coupon, 'id' | 'used_count'>;

export interface ShopSettings { free_delivery_over_paise: number; delivery_fee_paise: number; gift_wrap_paise: number; free_samples_count: number; delivery_eta_text: string }
export interface PaymentSettings { upi_vpa: string; upi_payee_name: string }

export interface WhatsAppRow { id: string; event: string; to_masked: string; template_id: string; params: string[]; status: 'sent' | 'failed' | 'skipped'; error: string | null; ref: string | null; created_at: string }
export interface CustomerRow { id: string; name: string; phone: string; email: string; birthday: string | null; created_at: string; last_login_at: string | null; orders_count: number; total_spent_paise: number }

export const commerceApi = {
  coupons: () => api.get<Coupon[]>('/admin/coupons').then((r) => r.data),
  saveCoupon: (id: string | null, b: CouponInput) => (id ? api.put<Coupon>(`/admin/coupons/${id}`, b) : api.post<Coupon>('/admin/coupons', b)).then((r) => r.data),

  shop: () => api.get<ShopSettings>('/admin/settings/shop').then((r) => r.data),
  saveShop: (b: ShopSettings) => api.put<ShopSettings>('/admin/settings/shop', b).then((r) => r.data),
  payment: () => api.get<PaymentSettings>('/admin/settings/payment').then((r) => r.data),
  savePayment: (b: PaymentSettings) => api.put<PaymentSettings>('/admin/settings/payment', b).then((r) => r.data),

  whatsapp: (q: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (q.status) p.set('status', q.status);
    if (q.page) p.set('page', String(q.page));
    return api.get<Page<WhatsAppRow>>(`/admin/whatsapp/messages?${p}`).then((r) => r.data);
  },
  customers: (q: { q?: string; page?: number }) => {
    const p = new URLSearchParams();
    if (q.q) p.set('q', q.q);
    if (q.page) p.set('page', String(q.page));
    return api.get<Page<CustomerRow>>(`/admin/customers?${p}`).then((r) => r.data);
  },
};
