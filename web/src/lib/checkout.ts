import type { Address } from '@/api/commerce';

/** Mirrors api/src/common/utils/phone.ts: returns "+91XXXXXXXXXX" or null. */
export function normalizeIndianMobile(raw: string): string | null {
  if (raw.length > 20) return null;
  let d = raw.replace(/[\s()-]/g, '');
  if (!/^\+?\d+$/.test(d)) return null;
  d = d.replace(/^\+/, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? `+91${d}` : null;
}

export interface AddressForm { name: string; phone: string; line1: string; line2: string; city: string; state: string; pincode: string }
export const emptyAddress = (over: Partial<AddressForm> = {}): AddressForm => ({ name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', ...over });

/** The same rules the API enforces, so mistakes show beside the field instead of as a failed order. */
export function validateAddress(a: AddressForm, states: readonly string[]): Partial<Record<keyof AddressForm, string>> {
  const e: Partial<Record<keyof AddressForm, string>> = {};
  if (!a.name.trim()) e.name = 'Please enter the name for delivery';
  if (!normalizeIndianMobile(a.phone)) e.phone = 'Enter a valid 10-digit mobile number';
  if (!a.line1.trim()) e.line1 = 'Enter the house / flat and street';
  if (!a.city.trim()) e.city = 'Enter the city';
  if (!states.includes(a.state)) e.state = 'Choose a state';
  if (!/^[1-9]\d{5}$/.test(a.pincode.trim())) e.pincode = 'Enter a 6-digit pincode';
  return e;
}

export const toAddress = (a: AddressForm): Address => ({
  name: a.name.trim(), phone: a.phone.trim(), line1: a.line1.trim(), ...(a.line2.trim() ? { line2: a.line2.trim() } : {}),
  city: a.city.trim(), state: a.state, pincode: a.pincode.trim(),
});

/**
 * Where to go after signing in. Only same-site paths are allowed: "?next=https://evil.com" or "//evil.com"
 * must never turn the login page into an open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = '/account'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n\t]/.test(next)) return fallback;
  if (/^\/(login)(\/|\?|$)/.test(next)) return fallback; // never bounce back to the login page
  return next;
}

// ── receipt upload ─────────────────────────────────────────────────────────

const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const RECEIPT_MAX = 5 * 1024 * 1024;

export function receiptProblem(file: { type: string; size: number }): string | null {
  if (!RECEIPT_TYPES.includes(file.type)) return 'Please upload a photo or screenshot (JPEG, PNG, WebP) or a PDF.';
  if (file.size <= 0) return 'That file is empty.';
  if (file.size > RECEIPT_MAX) return 'The file is over 5 MB. Please upload a smaller screenshot.';
  return null;
}

/** "2,850" / "₹2850.50" -> paise, or null when it isn't a valid amount. */
export function rupeesToPaise(input: string): number | null {
  const s = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [w, f = ''] = s.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
}

// ── order status, in words a customer understands ──────────────────────────

export const ORDER_STEPS = [
  { key: 'placed', label: 'Order placed' },
  { key: 'paid', label: 'Payment confirmed' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
] as const;

export function statusCopy(status: string): { title: string; text: string } {
  switch (status) {
    case 'PENDING_PAYMENT': return { title: 'Waiting for your payment', text: 'Pay by UPI using the details below, then upload your receipt. We pack your order once we confirm the payment.' };
    case 'PAYMENT_SUBMITTED': return { title: 'We’re checking your payment', text: 'Thanks! We’re matching your receipt with our bank. This usually doesn’t take long, and we’ll WhatsApp you as soon as it’s confirmed.' };
    case 'PAID': return { title: 'Payment confirmed', text: 'We’re packing your order.' };
    case 'PACKED': return { title: 'Packed', text: 'Your order is packed and will be handed to the courier shortly.' };
    case 'SHIPPED': return { title: 'On its way', text: 'Your order has been shipped.' };
    case 'DELIVERED': return { title: 'Delivered', text: 'We hope you love it.' };
    case 'CANCELLED': return { title: 'Cancelled', text: 'This order was cancelled.' };
    case 'REFUNDED': return { title: 'Refunded', text: 'This order was cancelled and refunded.' };
    default: return { title: status, text: '' };
  }
}

/** Which of ORDER_STEPS are done, from the order's timeline. */
export function completedSteps(t: Record<string, string | null>): string[] {
  return ORDER_STEPS.filter((s) => !!t[s.key]).map((s) => s.key);
}

/** Statuses where the page should keep checking for changes made by staff. */
export const LIVE_STATUSES = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'PACKED', 'SHIPPED'];
