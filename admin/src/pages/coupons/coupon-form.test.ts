import type { Coupon } from '@/api/commerce.api';
import { describeCoupon, emptyCoupon, fromCoupon, toCouponPayload, validateCoupon, type CouponForm } from './coupon-form';

const rupees = (p: number) => `₹${(p / 100).toLocaleString('en-IN')}`;
const f = (over: Partial<CouponForm> = {}): CouponForm => ({ ...emptyCoupon(), code: 'WELCOME10', ...over });

describe('validateCoupon', () => {
  it('accepts the defaults with a code', () => expect(validateCoupon(f())).toEqual({}));
  it.each(['ab', 'has space', 'x'.repeat(31), 'bad!', ''])('rejects the code %j', (code) => expect(validateCoupon(f({ code })).code).toBeTruthy());
  it.each(['0', '101', '10.5', 'abc', ''])('rejects the percentage %j', (value) => expect(validateCoupon(f({ value })).value).toBeTruthy());
  it('flat discounts are in rupees and must be at least ₹1', () => {
    expect(validateCoupon(f({ type: 'flat', value: '0.5' })).value).toBeTruthy();
    expect(validateCoupon(f({ type: 'flat', value: '500' }))).toEqual({});
  });
  it('checks optional money and count fields only when filled in', () => {
    expect(validateCoupon(f({ min_order: 'abc' })).min_order).toBeTruthy();
    expect(validateCoupon(f({ max_uses: '0' })).max_uses).toBeTruthy();
    expect(validateCoupon(f({ max_uses: '2.5' })).max_uses).toBeTruthy();
    expect(validateCoupon(f({ per_customer_limit: '' })).per_customer_limit).toBeTruthy();
  });
  it('the end must come after the start', () => {
    expect(validateCoupon(f({ starts_at: '2026-12-02T10:00', ends_at: '2026-12-01T10:00' })).ends_at).toBeTruthy();
    expect(validateCoupon(f({ starts_at: '2026-12-01T10:00', ends_at: '2026-12-02T10:00' }))).toEqual({});
  });
});

describe('toCouponPayload', () => {
  it('uppercases the code and keeps a percentage as a number', () => {
    expect(toCouponPayload(f({ code: ' welcome10 ', value: '15' }))).toMatchObject({ code: 'WELCOME10', type: 'percent', value: 15, min_order_paise: 0, max_discount_paise: null, max_uses: null });
  });
  it('converts rupees to exact paise for flat coupons, minimum order and cap', () => {
    expect(toCouponPayload(f({ type: 'flat', value: '499.50', min_order: '2,000' }))).toMatchObject({ value: 49950, min_order_paise: 200000 });
    expect(toCouponPayload(f({ max_discount: '500' })).max_discount_paise).toBe(50000);
  });
  it('a flat coupon never carries a cap', () => {
    expect(toCouponPayload(f({ type: 'flat', value: '100', max_discount: '500' })).max_discount_paise).toBeNull();
  });
  it('turns blank limits into "no limit" and dates into instants', () => {
    const p = toCouponPayload(f({ max_uses: '50', per_customer_limit: '0', ends_at: '2026-12-31T18:30' }));
    expect(p).toMatchObject({ max_uses: 50, per_customer_limit: 0 });
    expect(new Date(p.ends_at!).getTime()).toBe(new Date('2026-12-31T18:30').getTime());
    expect(p.starts_at).toBeNull();
  });
});

describe('fromCoupon round trip', () => {
  const c: Coupon = { id: '1', code: 'FLAT500', description: 'Festive', type: 'flat', value: 50000, min_order_paise: 200000, max_discount_paise: null, starts_at: null, ends_at: '2026-12-31T13:00:00.000Z', max_uses: 100, per_customer_limit: 1, used_count: 7, is_active: true };
  it('loads values in the units a person edits', () => {
    expect(fromCoupon(c)).toMatchObject({ value: '500', min_order: '2000', max_uses: '100', per_customer_limit: '1' });
  });
  it('re-saving unchanged gives the same coupon back', () => {
    const p = toCouponPayload(fromCoupon(c));
    expect(p).toMatchObject({ code: 'FLAT500', type: 'flat', value: 50000, min_order_paise: 200000, max_uses: 100, ends_at: c.ends_at });
  });
});

describe('describeCoupon', () => {
  it('reads naturally', () => {
    expect(describeCoupon({ type: 'percent', value: 10, max_discount_paise: 50000, min_order_paise: 0 } as Coupon, rupees)).toBe('10% off (up to ₹500)');
    expect(describeCoupon({ type: 'flat', value: 50000, max_discount_paise: null, min_order_paise: 200000 } as Coupon, rupees)).toBe('₹500 off on orders over ₹2,000');
  });
});
