export const ORDER_STATUSES = [
  'PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

// Shipping only ever follows a verified payment: there is no edge from PENDING_PAYMENT or
// PAYMENT_SUBMITTED to PACKED/SHIPPED. A rejected receipt goes back to PENDING_PAYMENT.
const NEXT: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ['PAYMENT_SUBMITTED', 'CANCELLED'],
  PAYMENT_SUBMITTED: ['PAID', 'PENDING_PAYMENT', 'CANCELLED'],
  PAID: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: ['REFUNDED'],
  REFUNDED: [],
};

export const canMove = (from: OrderStatus, to: OrderStatus) => NEXT[from].includes(to);

/** Statuses an order can still be cancelled from (stock goes back on the shelf). */
export const CANCELLABLE: readonly OrderStatus[] = ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'PACKED'];

/** Order numbers show as SM-001001 for sequence 1. */
const OFFSET = 1000;
export const formatOrderNo = (seq: number) => `SM-${String(seq + OFFSET).padStart(6, '0')}`;
export function parseOrderNo(s: string): number | null {
  const m = /^SM-(\d{6,9})$/i.exec(s.trim());
  const seq = m ? Number(m[1]) - OFFSET : NaN;
  return Number.isSafeInteger(seq) && seq >= 1 && seq <= 2_000_000_000 ? seq : null;
}
