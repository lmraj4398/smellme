import type { OrderDetail, OrderStatus } from '@/api/orders.api';
import { STATUSES } from '@/api/orders.api';
import { approveBody, availableActions, canApprove, paymentWarnings, STATUS_LABEL, STATUS_TONE } from './order-actions';

const pay = (over: Partial<OrderDetail['payment']> = {}): OrderDetail['payment'] => ({
  has_receipt: true, utr: 'REF1', claimed_amount_paise: 285000, expected_amount_paise: 285000, amount_mismatch: false,
  duplicate_utr_orders: [], submitted_at: null, verified_at: null, reject_reason: null, ...over,
});
const order = (status: OrderStatus, over: Partial<{ refund_due: boolean; has_receipt: boolean }> = {}) => ({
  status, payment: pay({ has_receipt: over.has_receipt ?? true }),
  cancel: { at: null, reason: null, by: null, refund_due: over.refund_due ?? false, refunded_at: null, refund_note: null },
});
const rupees = (p: number) => `₹${p / 100}`;

describe('availableActions', () => {
  it('offers exactly the next sensible steps', () => {
    expect(availableActions(order('PENDING_PAYMENT'))).toEqual(['cancel']);
    expect(availableActions(order('PAYMENT_SUBMITTED'))).toEqual(['approve', 'reject', 'cancel']);
    expect(availableActions(order('PAID'))).toEqual(['pack', 'cancel']);
    expect(availableActions(order('PACKED'))).toEqual(['ship', 'cancel']);
    expect(availableActions(order('SHIPPED'))).toEqual(['deliver']);
    expect(availableActions(order('DELIVERED'))).toEqual([]);
    expect(availableActions(order('REFUNDED'))).toEqual([]);
  });

  it('never offers packing or shipping before the payment is approved', () => {
    for (const s of ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED'] as const) {
      const a = availableActions(order(s));
      expect(a).not.toContain('pack');
      expect(a).not.toContain('ship');
      expect(a).not.toContain('deliver');
    }
  });

  it('cannot approve without a receipt to look at', () => {
    expect(availableActions(order('PAYMENT_SUBMITTED', { has_receipt: false }))).toEqual(['cancel']);
  });

  it('offers a refund only for a cancelled order that is owed one', () => {
    expect(availableActions(order('CANCELLED'))).toEqual([]);
    expect(availableActions(order('CANCELLED', { refund_due: true }))).toEqual(['refund']);
  });

  it('shipped orders can no longer be cancelled', () => {
    for (const s of ['SHIPPED', 'DELIVERED'] as const) expect(availableActions(order(s))).not.toContain('cancel');
  });

  it('has a label and tone for every status', () => {
    for (const s of STATUSES) { expect(STATUS_LABEL[s]).toBeTruthy(); expect(STATUS_TONE[s]).toBeTruthy(); }
  });
});

describe('payment warnings', () => {
  it('has none for a clean receipt', () => expect(paymentWarnings(pay(), rupees)).toEqual([]));

  it('flags an amount mismatch with both figures', () => {
    const w = paymentWarnings(pay({ amount_mismatch: true, claimed_amount_paise: 250000 }), rupees);
    expect(w).toHaveLength(1);
    expect(w[0]).toMatchObject({ id: 'mismatch' });
    expect(w[0].text).toContain('₹2500');
    expect(w[0].text).toContain('₹2850');
  });

  it('flags a payment reference used on other orders, naming them', () => {
    const w = paymentWarnings(pay({ duplicate_utr_orders: [{ order_no: 'SM-001002', status: 'PAID' }, { order_no: 'SM-001003', status: 'PAID' }] }), rupees);
    expect(w[0].text).toContain('SM-001002, SM-001003');
  });

  it('approval stays blocked until every warning is knowingly ticked', () => {
    const w = paymentWarnings(pay({ amount_mismatch: true, claimed_amount_paise: 1, duplicate_utr_orders: [{ order_no: 'SM-001002', status: 'PAID' }] }), rupees);
    expect(canApprove(w, new Set())).toBe(false);
    expect(canApprove(w, new Set(['mismatch']))).toBe(false);
    expect(canApprove(w, new Set(['mismatch', 'duplicate']))).toBe(true);
    expect(canApprove([], new Set())).toBe(true);
  });

  it('sends only the confirmations that apply, and only when ticked', () => {
    const both = paymentWarnings(pay({ amount_mismatch: true, claimed_amount_paise: 1, duplicate_utr_orders: [{ order_no: 'SM-001002', status: 'PAID' }] }), rupees);
    expect(approveBody(both, new Set(['mismatch', 'duplicate']))).toEqual({ confirm_amount_mismatch: true, confirm_duplicate_utr: true });
    expect(approveBody(both, new Set(['mismatch']))).toEqual({ confirm_amount_mismatch: true });
    expect(approveBody([], new Set(['mismatch', 'duplicate']))).toEqual({}); // a stale tick never sends a confirmation
  });
});
