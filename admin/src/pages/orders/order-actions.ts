import type { OrderDetail, OrderStatus } from '@/api/orders.api';

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAYMENT_SUBMITTED: 'Verify payment',
  PAID: 'Ready to pack',
  PACKED: 'Ready to ship',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
};

export const STATUS_TONE: Record<OrderStatus, 'neutral' | 'ok' | 'warn' | 'off'> = {
  PENDING_PAYMENT: 'off', PAYMENT_SUBMITTED: 'warn', PAID: 'warn', PACKED: 'warn', SHIPPED: 'neutral', DELIVERED: 'ok', CANCELLED: 'off', REFUNDED: 'off',
};

export type Action = 'approve' | 'reject' | 'pack' | 'ship' | 'deliver' | 'cancel' | 'refund';

/**
 * The steps the screen offers for an order. Mirrors the API's state machine, which is the real authority
 * (it refuses anything else); this only decides which buttons to show.
 */
export function availableActions(o: Pick<OrderDetail, 'status' | 'cancel' | 'payment'>): Action[] {
  switch (o.status) {
    case 'PENDING_PAYMENT': return ['cancel'];
    case 'PAYMENT_SUBMITTED': return o.payment.has_receipt ? ['approve', 'reject', 'cancel'] : ['cancel'];
    case 'PAID': return ['pack', 'cancel'];
    case 'PACKED': return ['ship', 'cancel'];
    case 'SHIPPED': return ['deliver'];
    case 'CANCELLED': return o.cancel.refund_due ? ['refund'] : [];
    default: return [];
  }
}

export interface Warning { id: 'mismatch' | 'duplicate'; text: string }

/** Things staff must see (and consciously confirm) before approving a payment. */
export function paymentWarnings(p: OrderDetail['payment'], rupees: (paise: number) => string): Warning[] {
  const out: Warning[] = [];
  if (p.amount_mismatch && p.claimed_amount_paise !== null) {
    out.push({ id: 'mismatch', text: `The customer says they paid ${rupees(p.claimed_amount_paise)}, but the order total is ${rupees(p.expected_amount_paise)}.` });
  }
  if (p.duplicate_utr_orders.length) {
    out.push({ id: 'duplicate', text: `This payment reference was also used on ${p.duplicate_utr_orders.map((d) => d.order_no).join(', ')}.` });
  }
  return out;
}

/** The body for the approve call: only confirmations the person actually ticked for warnings that exist. */
export function approveBody(warnings: Warning[], ticked: Set<Warning['id']>) {
  return {
    ...(warnings.some((w) => w.id === 'mismatch') && ticked.has('mismatch') ? { confirm_amount_mismatch: true } : {}),
    ...(warnings.some((w) => w.id === 'duplicate') && ticked.has('duplicate') ? { confirm_duplicate_utr: true } : {}),
  };
}

export const canApprove = (warnings: Warning[], ticked: Set<Warning['id']>) => warnings.every((w) => ticked.has(w.id));
