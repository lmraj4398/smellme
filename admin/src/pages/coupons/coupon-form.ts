import type { Coupon, CouponInput } from '@/api/commerce.api';
import { paiseToRupees, rupeesToPaise } from '@/lib/money';

export interface CouponForm {
  code: string; description: string; type: 'percent' | 'flat'; value: string; min_order: string; max_discount: string;
  starts_at: string; ends_at: string; max_uses: string; per_customer_limit: string; is_active: boolean;
}

// <input type="datetime-local"> works in local time without a zone; the API wants an instant.
const toLocalInput = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '');
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export const emptyCoupon = (): CouponForm => ({
  code: '', description: '', type: 'percent', value: '10', min_order: '', max_discount: '', starts_at: '', ends_at: '', max_uses: '', per_customer_limit: '1', is_active: true,
});

export function fromCoupon(c: Coupon): CouponForm {
  return {
    code: c.code, description: c.description, type: c.type,
    value: c.type === 'percent' ? String(c.value) : paiseToRupees(c.value),
    min_order: c.min_order_paise ? paiseToRupees(c.min_order_paise) : '', max_discount: c.max_discount_paise ? paiseToRupees(c.max_discount_paise) : '',
    starts_at: toLocalInput(c.starts_at), ends_at: toLocalInput(c.ends_at), max_uses: c.max_uses === null ? '' : String(c.max_uses),
    per_customer_limit: String(c.per_customer_limit), is_active: c.is_active,
  };
}

export function validateCoupon(f: CouponForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(f.code.trim())) e.code = '3-30 letters, numbers, - or _';
  if (f.type === 'percent') {
    const n = Number(f.value);
    if (!Number.isInteger(n) || n < 1 || n > 100) e.value = 'A whole number from 1 to 100';
  } else {
    const p = rupeesToPaise(f.value);
    if (p === null || p < 100) e.value = 'At least ₹1';
  }
  if (f.min_order.trim() && rupeesToPaise(f.min_order) === null) e.min_order = 'Enter an amount';
  if (f.type === 'percent' && f.max_discount.trim()) {
    const p = rupeesToPaise(f.max_discount);
    if (p === null || p < 100) e.max_discount = 'At least ₹1';
  }
  if (f.max_uses.trim() && (!/^\d+$/.test(f.max_uses) || Number(f.max_uses) < 1)) e.max_uses = 'A whole number, 1 or more';
  if (!/^\d+$/.test(f.per_customer_limit) || Number(f.per_customer_limit) > 100) e.per_customer_limit = '0 (no limit) to 100';
  if (f.starts_at && f.ends_at && new Date(f.ends_at) <= new Date(f.starts_at)) e.ends_at = 'Must be after the start';
  return e;
}

export function toCouponPayload(f: CouponForm): CouponInput {
  return {
    code: f.code.trim().toUpperCase(), description: f.description.trim(), type: f.type,
    value: f.type === 'percent' ? Number(f.value) : rupeesToPaise(f.value)!,
    min_order_paise: f.min_order.trim() ? rupeesToPaise(f.min_order)! : 0,
    max_discount_paise: f.type === 'percent' && f.max_discount.trim() ? rupeesToPaise(f.max_discount)! : null,
    starts_at: fromLocalInput(f.starts_at), ends_at: fromLocalInput(f.ends_at),
    max_uses: f.max_uses.trim() ? Number(f.max_uses) : null, per_customer_limit: Number(f.per_customer_limit), is_active: f.is_active,
  };
}

export function describeCoupon(c: Coupon, rupees: (p: number) => string): string {
  const off = c.type === 'percent' ? `${c.value}% off${c.max_discount_paise ? ` (up to ${rupees(c.max_discount_paise)})` : ''}` : `${rupees(c.value)} off`;
  return c.min_order_paise ? `${off} on orders over ${rupees(c.min_order_paise)}` : off;
}
