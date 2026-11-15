import type { ScentFamilyShare } from '@/lib/scent-profile';
import { api, type CustomerSession } from './client';
import type { Customer } from '@/store/customer.store';

// ── public: bag pricing, settings ──────────────────────────────────────────

export interface PricedLine {
  variant_id: string; product_slug: string; sku: string; name: string; brand: string; label: string; size_ml: number;
  unit_price_paise: number; qty: number; line_total_paise: number; is_free_sample: boolean; image_key: string | null;
  issue?: 'unavailable' | 'insufficient_stock'; available?: number;
}
export interface PricedCart {
  lines: PricedLine[]; issues: PricedLine[]; subtotal_paise: number; discount_paise: number; coupon: { code: string; description: string } | null;
  coupon_error: string | null; delivery_fee_paise: number; gift_wrap_paise: number; total_paise: number;
  free_delivery_over_paise: number; free_samples_allowed: number;
}
export interface CartInput { lines: { variant_id: string; qty: number }[]; coupon_code?: string; gift_wrap?: boolean; free_sample_ids?: string[] }
export interface PublicSettings { free_delivery_over_paise: number; delivery_fee_paise: number; gift_wrap_paise: number; free_samples_count: number; delivery_eta_text: string; states: string[] }
export interface SampleChoice { variant_id: string; product_name: string; brand: string; label: string; tint: string; liquid: string; mono: string }

export interface Address { name: string; phone: string; line1: string; line2?: string; city: string; state: string; pincode: string }
export interface SavedAddress extends Address { id: string; label: string; is_default: boolean }

export interface OrderView {
  order_no: string; status: string; created_at: string;
  totals: { subtotal_paise: number; discount_paise: number; delivery_fee_paise: number; gift_wrap_paise: number; total_paise: number };
  coupon_code: string | null; gift: { wrap: boolean; message: string; engraving: string };
  address: Required<Address>;
  items: { name: string; brand: string; label: string; qty: number; unit_price_paise: number; line_total_paise: number; is_free_sample: boolean; product_slug: string }[];
  payment: { upi_vpa: string; payee_name: string; amount_paise: number; reference: string; upi_uri: string } | { unavailable: true } | null;
  payment_submitted: boolean; payment_reject_reason: string | null;
  shipping: { carrier: string | null; tracking_no: string | null; shipped_at: string } | null;
  timeline: Record<'placed' | 'payment_submitted' | 'paid' | 'packed' | 'shipped' | 'delivered' | 'cancelled', string | null>;
  cancel_reason: string | null; refund_due: boolean; refunded: boolean; can_cancel: boolean; can_upload_receipt: boolean;
}
export interface OrderSummary { order_no: string; status: string; created_at: string; total_paise: number; items: { name: string; label: string; qty: number }[] }
export interface Presigned { key: string; upload_url: string; headers: Record<string, string>; expires_in: number }

export const commerceApi = {
  priceCart: (b: CartInput) => api.post<PricedCart>('/cart/price', b).then((r) => r.data),
  settings: () => api.get<PublicSettings>('/settings/public').then((r) => r.data),
  samples: () => api.get<SampleChoice[]>('/samples').then((r) => r.data),
  checkPincode: (pincode: string) => api.get<{ pincode: string; serviceable: boolean; eta_text: string }>(`/delivery/check?pincode=${pincode}`).then((r) => r.data),

  // customer auth
  sendOtp: (phone: string) => api.post<{ ok: true; expires_in: number; resend_after: number }>('/customer/otp/send', { phone }).then((r) => r.data),
  verifyOtp: (phone: string, code: string, name?: string) => api.post<CustomerSession>('/customer/otp/verify', { phone, code, ...(name ? { name } : {}) }).then((r) => r.data),
  logout: () => api.post('/customer/logout').then((r) => r.data),
  me: () => api.get<Customer>('/customer/me').then((r) => r.data),
  scentProfile: () => api.get<{ families: ScentFamilyShare[] }>('/customer/me/scent-profile').then((r) => r.data.families),
  updateMe: (b: { name?: string; email?: string; birthday?: string }) => api.patch<Customer>('/customer/me', b).then((r) => r.data),

  addresses: () => api.get<SavedAddress[]>('/customer/addresses').then((r) => r.data),
  saveAddress: (id: string | null, b: Address & { label?: string; is_default?: boolean }) => (id ? api.put<SavedAddress>(`/customer/addresses/${id}`, b) : api.post<SavedAddress>('/customer/addresses', b)).then((r) => r.data),
  deleteAddress: (id: string) => api.delete(`/customer/addresses/${id}`).then((r) => r.data),

  // orders
  createOrder: (b: CartInput & { client_ref: string; address: Address; gift_message?: string; engraving?: string }) => api.post<OrderView>('/customer/orders', b).then((r) => r.data),
  orders: () => api.get<{ total: number; items: OrderSummary[] }>('/customer/orders').then((r) => r.data),
  order: (no: string) => api.get<OrderView>(`/customer/orders/${encodeURIComponent(no)}`).then((r) => r.data),
  presignReceipt: (no: string, content_type: string, size: number) => api.post<Presigned>(`/customer/orders/${encodeURIComponent(no)}/receipt/presign`, { content_type, size }).then((r) => r.data),
  submitReceipt: (no: string, b: { key: string; utr?: string; paid_amount_paise?: number }) => api.post<OrderView>(`/customer/orders/${encodeURIComponent(no)}/receipt`, b).then((r) => r.data),
  cancelOrder: (no: string) => api.post<OrderView>(`/customer/orders/${encodeURIComponent(no)}/cancel`).then((r) => r.data),
};
