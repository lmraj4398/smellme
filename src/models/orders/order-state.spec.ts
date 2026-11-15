import { canMove, CANCELLABLE, formatOrderNo, ORDER_STATUSES, parseOrderNo, type OrderStatus } from './order-state';

describe('order state machine', () => {
  const allowed: [OrderStatus, OrderStatus][] = [
    ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'], ['PENDING_PAYMENT', 'CANCELLED'],
    ['PAYMENT_SUBMITTED', 'PAID'], ['PAYMENT_SUBMITTED', 'PENDING_PAYMENT'], ['PAYMENT_SUBMITTED', 'CANCELLED'],
    ['PAID', 'PACKED'], ['PAID', 'CANCELLED'], ['PACKED', 'SHIPPED'], ['PACKED', 'CANCELLED'],
    ['SHIPPED', 'DELIVERED'], ['CANCELLED', 'REFUNDED'],
  ];

  it.each(allowed)('%s -> %s is allowed', (a, b) => expect(canMove(a, b)).toBe(true));

  it('allows nothing else (exhaustive over every pair)', () => {
    for (const a of ORDER_STATUSES) for (const b of ORDER_STATUSES) {
      const should = allowed.some(([x, y]) => x === a && y === b);
      expect(canMove(a, b)).toBe(should);
    }
  });

  it('can NEVER ship or pack before the payment is verified', () => {
    for (const early of ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'] as const) {
      for (const late of ['PACKED', 'SHIPPED', 'DELIVERED'] as const) expect(canMove(early, late)).toBe(false);
    }
    expect(canMove('PAYMENT_SUBMITTED', 'PAID')).toBe(true);
  });

  it('finished orders are final, and shipped orders cannot be cancelled', () => {
    for (const to of ORDER_STATUSES) { expect(canMove('DELIVERED', to)).toBe(false); expect(canMove('REFUNDED', to)).toBe(false); }
    expect(canMove('SHIPPED', 'CANCELLED')).toBe(false);
    expect(CANCELLABLE).not.toContain('SHIPPED');
  });

  it('cancellable statuses match the machine', () => {
    for (const s of ORDER_STATUSES) expect(CANCELLABLE.includes(s)).toBe(canMove(s, 'CANCELLED'));
  });
});

describe('order numbers', () => {
  it('formats and parses', () => {
    expect(formatOrderNo(1)).toBe('SM-001001');
    expect(formatOrderNo(1234)).toBe('SM-002234');
    expect(parseOrderNo('SM-001001')).toBe(1);
    expect(parseOrderNo(' sm-002234 ')).toBe(1234);
  });
  it('round-trips', () => { for (const n of [1, 9, 99, 12345, 999999]) expect(parseOrderNo(formatOrderNo(n))).toBe(n); });
  it.each(['', 'SM-1001', 'SM-000000', 'SM-000500', 'SM-001001; DROP', 'XX-001001', 'SM-99999999999999999', '001001', 'SM--01001'])('rejects %j', (s) => expect(parseOrderNo(s)).toBeNull());
});
