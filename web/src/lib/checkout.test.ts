import { INDIAN_STATES_FOR_TEST } from '@/test/states';
import { bagToInput, NO_OPTIONS, type BagLine } from '@/store/cart.store';
import { completedSteps, emptyAddress, normalizeIndianMobile, receiptProblem, RECEIPT_MAX, rupeesToPaise, safeNext, statusCopy, toAddress, validateAddress } from './checkout';

describe('normalizeIndianMobile (must match the API)', () => {
  it.each([['9876543210', '+919876543210'], ['98765 43210', '+919876543210'], ['09876543210', '+919876543210'], ['+91 98765-43210', '+919876543210'], ['919876543210', '+919876543210']])('%s', (i, o) => expect(normalizeIndianMobile(i)).toBe(o));
  it.each(['', '12345', '5876543210', '+14155552671', 'abcdefghij', '9876543210x'])('rejects %j', (v) => expect(normalizeIndianMobile(v)).toBeNull());
});

describe('validateAddress', () => {
  const ok = emptyAddress({ name: 'Anaya', phone: '98765 43210', line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' });
  it('accepts a complete address', () => expect(validateAddress(ok, INDIAN_STATES_FOR_TEST)).toEqual({}));
  it('flags every missing or invalid field at once', () => {
    expect(Object.keys(validateAddress(emptyAddress(), INDIAN_STATES_FOR_TEST)).sort()).toEqual(['city', 'line1', 'name', 'phone', 'pincode', 'state']);
  });
  it.each(['056001', '5600', 'abcdef', '56000a', '5600011'])('rejects the pincode %j', (pincode) => expect(validateAddress({ ...ok, pincode }, INDIAN_STATES_FOR_TEST).pincode).toBeTruthy());
  it('rejects a state that is not on the list', () => expect(validateAddress({ ...ok, state: 'Atlantis' }, INDIAN_STATES_FOR_TEST).state).toBeTruthy());
  it('trims, and leaves line2 out when blank', () => {
    expect(toAddress({ ...ok, name: ' Anaya ', line2: '  ' })).toEqual({ name: 'Anaya', phone: '98765 43210', line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' });
  });
});

describe('safeNext (no open redirects)', () => {
  it.each([['/checkout', '/checkout'], ['/order/SM-001001', '/order/SM-001001'], ['/shop?family=amber', '/shop?family=amber']])('allows %s', (i, o) => expect(safeNext(i)).toBe(o));
  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'evil.com', '', '/login', '/login?next=/x', '/ok\nhttps://evil.com'])('refuses %j', (v) => expect(safeNext(v)).toBe('/account'));
  it('uses the given fallback, and handles null', () => { expect(safeNext(null)).toBe('/account'); expect(safeNext('//x', '/')).toBe('/'); });
});

describe('receiptProblem', () => {
  it('accepts images and PDFs up to 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) expect(receiptProblem({ type, size: 1000 })).toBeNull();
    expect(receiptProblem({ type: 'image/png', size: RECEIPT_MAX })).toBeNull();
  });
  it('refuses other types, empty files and files over 5 MB', () => {
    for (const type of ['image/svg+xml', 'text/html', 'application/zip', '']) expect(receiptProblem({ type, size: 1000 })).toMatch(/photo or screenshot/);
    expect(receiptProblem({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(receiptProblem({ type: 'image/png', size: RECEIPT_MAX + 1 })).toMatch(/5 MB/);
  });
});

describe('rupeesToPaise', () => {
  it.each([['2850', 285000], ['2,850.50', 285050], ['₹ 190', 19000]])('%s', (i, o) => expect(rupeesToPaise(i)).toBe(o));
  it.each(['', 'abc', '-5', '12.345', '1e3'])('rejects %j', (v) => expect(rupeesToPaise(v)).toBeNull());
});

describe('order status copy', () => {
  it('has plain-language copy for every status', () => {
    for (const s of ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']) {
      expect(statusCopy(s).title).toBeTruthy();
      expect(statusCopy(s).text).toBeTruthy();
    }
  });
  it('lists which steps are done', () => {
    expect(completedSteps({ placed: 'x', paid: null, packed: null, shipped: null, delivered: null })).toEqual(['placed']);
    expect(completedSteps({ placed: 'x', paid: 'y', packed: 'z', shipped: null, delivered: null })).toEqual(['placed', 'paid', 'packed']);
  });
});

describe('bagToInput: ids and quantities only, never prices', () => {
  const line = (id: string, qty: number): BagLine => ({ variantId: id, productSlug: 's', name: 'n', brand: 'b', label: 'l', price_paise: 99999999, tint: '', liquid: '', mono: '', image: null, qty });
  it('sends no price, name or label', () => {
    const input = bagToInput([line('v1', 2)], NO_OPTIONS);
    expect(input).toEqual({ lines: [{ variant_id: 'v1', qty: 2 }] });
    expect(JSON.stringify(input)).not.toContain('99999999');
  });
  it('adds only the options that are set', () => {
    expect(bagToInput([line('v1', 1)], { ...NO_OPTIONS, coupon_code: ' TEN ', gift_wrap: true, free_sample_ids: ['s1'] })).toEqual({
      lines: [{ variant_id: 'v1', qty: 1 }], coupon_code: 'TEN', gift_wrap: true, free_sample_ids: ['s1'],
    });
  });
});
