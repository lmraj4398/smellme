import type { OrderView, PricedCart, PricedLine, SavedAddress } from '@/api/commerce';
import type { BagLine } from '@/store/cart.store';
import { V50 } from './render';

export const bagLine = (over: Partial<BagLine> = {}): BagLine => ({
  variantId: V50, productSlug: 'saffron-dusk', name: 'Saffron Dusk', brand: 'SmellMe Originals', label: '50 ml', price_paise: 111111, // deliberately WRONG: the server's price must win
  tint: '#F3E6D6', liquid: '#D7A260', mono: 'SD', image: null, qty: 1, ...over,
});

export const pLine = (over: Partial<PricedLine> = {}): PricedLine => ({
  variant_id: V50, product_slug: 'saffron-dusk', sku: 'sd-50', name: 'Saffron Dusk', brand: 'SmellMe Originals', label: '50 ml', size_ml: 50,
  unit_price_paise: 285000, qty: 1, line_total_paise: 285000, is_free_sample: false, image_key: null, ...over,
});

export const priced = (over: Partial<PricedCart> = {}): PricedCart => ({
  lines: [pLine()], issues: [], subtotal_paise: 285000, discount_paise: 0, coupon: null, coupon_error: null, delivery_fee_paise: 0, gift_wrap_paise: 0,
  total_paise: 285000, free_delivery_over_paise: 200000, free_samples_allowed: 2, ...over,
});

const STATES = ['Delhi', 'Karnataka', 'Maharashtra'];
export const settings = { free_delivery_over_paise: 200000, delivery_fee_paise: 9900, gift_wrap_paise: 15000, free_samples_count: 2, delivery_eta_text: '3–7 working days', states: STATES };

export const savedAddress = (over: Partial<SavedAddress> = {}): SavedAddress => ({
  id: 'a1', label: 'Home', name: 'Anaya Rao', phone: '+919876543210', line1: '12 MG Road', line2: '', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', is_default: true, ...over,
});

export const orderView = (over: Partial<OrderView> = {}): OrderView => ({
  order_no: 'SM-001001', status: 'PENDING_PAYMENT', created_at: '2026-10-21T10:00:00Z',
  totals: { subtotal_paise: 285000, discount_paise: 0, delivery_fee_paise: 0, gift_wrap_paise: 0, total_paise: 285000 },
  coupon_code: null, gift: { wrap: false, message: '', engraving: '' },
  address: { name: 'Anaya Rao', phone: '+919876543210', line1: '12 MG Road', line2: '', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
  items: [{ name: 'Saffron Dusk', brand: 'SmellMe Originals', label: '50 ml', qty: 1, unit_price_paise: 285000, line_total_paise: 285000, is_free_sample: false, product_slug: 'saffron-dusk' }],
  payment: { upi_vpa: 'smellme@okhdfcbank', payee_name: 'SmellMe', amount_paise: 285000, reference: 'SM-001001', upi_uri: 'upi://pay?pa=smellme%40okhdfcbank&pn=SmellMe&tn=SM-001001&cu=INR' },
  payment_submitted: false, payment_reject_reason: null, shipping: null,
  timeline: { placed: '2026-10-21T10:00:00Z', payment_submitted: null, paid: null, packed: null, shipped: null, delivered: null, cancelled: null },
  cancel_reason: null, refund_due: false, refunded: false, can_cancel: true, can_upload_receipt: true, ...over,
});

