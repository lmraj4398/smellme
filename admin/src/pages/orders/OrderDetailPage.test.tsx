import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ordersApi, type OrderDetail, type OrderStatus } from '@/api/orders.api';
import { renderPage, signIn } from '@/test/render-page';
import OrderDetailPage from './OrderDetailPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/orders.api', async (orig) => ({
  ...(await orig<typeof import('@/api/orders.api')>()),
  ordersApi: { detail: vi.fn(), receiptUrl: vi.fn(), approve: vi.fn(), reject: vi.fn(), pack: vi.fn(), ship: vi.fn(), deliver: vi.fn(), cancel: vi.fn(), refund: vi.fn(), summary: vi.fn(), list: vi.fn() },
}));

const order = (status: OrderStatus = 'PAYMENT_SUBMITTED', over: Partial<OrderDetail> = {}): OrderDetail => ({
  id: 'o1', order_no: 'SM-001001', status, created_at: '2026-10-21T10:00:00Z',
  customer: { id: 'c1', name: 'Anaya', phone: '+919876543210', email: '' },
  address: { name: 'Anaya Rao', phone: '+919876543210', line1: '12 MG Road', line2: '', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
  totals: { subtotal_paise: 285000, discount_paise: 0, delivery_fee_paise: 0, gift_wrap_paise: 0, total_paise: 285000 },
  coupon_code: null, gift: { wrap: false, message: '', engraving: '' },
  items: [{ name: 'Saffron Dusk', brand: 'SmellMe Originals', label: '50 ml', sku: 'sd-50', qty: 1, unit_price_paise: 285000, line_total_paise: 285000, is_free_sample: false }],
  payment: { has_receipt: true, utr: 'REF123456789', claimed_amount_paise: 285000, expected_amount_paise: 285000, amount_mismatch: false, duplicate_utr_orders: [], submitted_at: '2026-10-21T10:05:00Z', verified_at: null, reject_reason: null },
  shipping: { carrier: null, tracking_no: null, packed_at: null, shipped_at: null, delivered_at: null },
  cancel: { at: null, reason: null, by: null, refund_due: false, refunded_at: null, refund_note: null },
  events: [{ at: '2026-10-21T10:00:00Z', from: null, to: 'PENDING_PAYMENT', actor: 'customer', note: null, meta: null }],
  ...over,
});

const open = (o: OrderDetail) => {
  vi.mocked(ordersApi.detail).mockResolvedValue(o);
  return renderPage(<OrderDetailPage />, { path: '/orders/:id', route: '/orders/o1' });
};
const btn = (name: RegExp | string) => screen.getByRole('button', { name });

beforeEach(() => {
  signIn();
  vi.mocked(ordersApi.approve).mockImplementation(async () => order('PAID'));
});

describe('OrderDetailPage: verifying a payment', () => {
  it('shows what to expect, what the customer claims and the reference, so staff can check the bank', async () => {
    open(order());
    expect(await screen.findByRole('heading', { name: 'SM-001001' })).toBeInTheDocument();
    const pay = screen.getByRole('region', { name: 'Payment' });
    expect(within(pay).getByText('Amount to receive').nextSibling).toHaveTextContent('₹2,850');
    expect(within(pay).getByText('REF123456789')).toBeInTheDocument();
  });

  it('a clean receipt can be approved with one click, sending no confirmations', async () => {
    open(order());
    await userEvent.click(await screen.findByRole('button', { name: 'Approve payment' }));
    await waitFor(() => expect(ordersApi.approve).toHaveBeenCalledWith('o1', {}));
  });

  it('an amount mismatch blocks approval until the person ticks that they checked, then sends the confirmation', async () => {
    open(order('PAYMENT_SUBMITTED', { payment: { ...order().payment, claimed_amount_paise: 250000, amount_mismatch: true } }));
    const approve = await screen.findByRole('button', { name: 'Approve payment' });
    expect(screen.getByRole('alert')).toHaveTextContent(/₹2,500.*₹2,850/);
    expect(approve).toBeDisabled();
    await userEvent.click(approve);
    expect(ordersApi.approve).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('checkbox', { name: /checked and want to approve/i }));
    expect(approve).toBeEnabled();
    await userEvent.click(approve);
    await waitFor(() => expect(ordersApi.approve).toHaveBeenCalledWith('o1', { confirm_amount_mismatch: true }));
  });

  it('a reference used on another order needs its own confirmation, and names that order', async () => {
    open(order('PAYMENT_SUBMITTED', { payment: { ...order().payment, duplicate_utr_orders: [{ order_no: 'SM-001000', status: 'PAID' }] } }));
    const approve = await screen.findByRole('button', { name: 'Approve payment' });
    expect(screen.getByRole('alert')).toHaveTextContent('SM-001000');
    expect(approve).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(approve);
    await waitFor(() => expect(ordersApi.approve).toHaveBeenCalledWith('o1', { confirm_duplicate_utr: true }));
  });

  it('loads the receipt only on request, from a fresh signed link', async () => {
    vi.mocked(ordersApi.receiptUrl).mockResolvedValue({ url: 'https://private.r2/receipt.png?sig=1', expires_in: 300, is_pdf: false });
    open(order());
    await screen.findByRole('heading', { name: 'SM-001001' });
    expect(ordersApi.receiptUrl).not.toHaveBeenCalled();
    await userEvent.click(btn(/view receipt/i));
    expect(await screen.findByAltText(/payment receipt/i)).toHaveAttribute('src', 'https://private.r2/receipt.png?sig=1');
  });

  it('offers a PDF receipt as a link, not an inline image', async () => {
    vi.mocked(ordersApi.receiptUrl).mockResolvedValue({ url: 'https://private.r2/r.pdf?sig=1', expires_in: 300, is_pdf: true });
    open(order());
    await userEvent.click(await screen.findByRole('button', { name: /view receipt/i }));
    expect(await screen.findByRole('link', { name: /open pdf receipt/i })).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('rejecting needs a reason and sends it', async () => {
    vi.mocked(ordersApi.reject).mockResolvedValue(order('PENDING_PAYMENT'));
    open(order());
    await userEvent.click(await screen.findByRole('button', { name: 'Reject payment' }));
    const dlg = screen.getByRole('dialog', { name: 'Reject payment' });
    expect(within(dlg).getByRole('button', { name: 'Reject payment' })).toBeDisabled();
    await userEvent.type(within(dlg).getByLabelText(/why/i), 'Amount does not match');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Reject payment' }));
    await waitFor(() => expect(ordersApi.reject).toHaveBeenCalledWith('o1', 'Amount does not match'));
  });

  it('shows the server\'s reason when approval is refused', async () => {
    vi.mocked(ordersApi.approve).mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: { message: 'This order is paid, not awaiting verification' } } }));
    const { toast } = await import('sonner');
    open(order());
    await userEvent.click(await screen.findByRole('button', { name: 'Approve payment' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/awaiting verification|something went wrong/i)));
  });
});

describe('OrderDetailPage: the rest of the journey', () => {
  it('a payment awaiting upload offers only cancel: nothing to verify, pack or ship', async () => {
    open(order('PENDING_PAYMENT', { payment: { ...order().payment, has_receipt: false } }));
    await screen.findByRole('heading', { name: 'SM-001001' });
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
    for (const n of [/approve/i, /reject/i, /packed/i, /shipped/i, /delivered/i]) expect(screen.queryByRole('button', { name: n })).toBeNull();
  });

  it('PAID -> pack', async () => {
    vi.mocked(ordersApi.pack).mockResolvedValue(order('PACKED'));
    open(order('PAID'));
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as packed' }));
    await waitFor(() => expect(ordersApi.pack).toHaveBeenCalledWith('o1'));
  });

  it('PACKED -> ship needs a courier and tracking number', async () => {
    vi.mocked(ordersApi.ship).mockResolvedValue(order('SHIPPED'));
    open(order('PACKED'));
    await userEvent.click(await screen.findByRole('button', { name: 'Mark as shipped' }));
    const dlg = screen.getByRole('dialog', { name: 'Mark as shipped' });
    const go = within(dlg).getByRole('button', { name: 'Mark as shipped' });
    expect(go).toBeDisabled();
    await userEvent.type(within(dlg).getByLabelText('Courier'), ' DTDC ');
    expect(go).toBeDisabled();
    await userEvent.type(within(dlg).getByLabelText('Tracking number'), 'D1234567');
    await userEvent.click(go);
    await waitFor(() => expect(ordersApi.ship).toHaveBeenCalledWith('o1', 'DTDC', 'D1234567'));
  });

  it('shipped orders can be delivered but not cancelled', async () => {
    open(order('SHIPPED', { shipping: { carrier: 'DTDC', tracking_no: 'D1', packed_at: null, shipped_at: null, delivered_at: null } }));
    await screen.findByRole('heading', { name: 'SM-001001' });
    expect(screen.getByRole('button', { name: 'Mark as delivered' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).toBeNull();
    expect(screen.getByText(/D1/)).toBeInTheDocument();
  });

  it('a cancelled order that was paid shows the refund that is still owed, and lets staff record it', async () => {
    vi.mocked(ordersApi.refund).mockResolvedValue(order('REFUNDED'));
    open(order('CANCELLED', { cancel: { at: '2026-10-21T11:00:00Z', reason: 'Out of packaging', by: 'admin', refund_due: true, refunded_at: null, refund_note: null } }));
    expect(await screen.findByText(/refund of ₹2,850 is still due/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Record refund' }));
    const dlg = screen.getByRole('dialog', { name: 'Record refund' });
    await userEvent.type(within(dlg).getByLabelText(/refund reference/i), 'UPI ref 998877');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Mark as refunded' }));
    await waitFor(() => expect(ordersApi.refund).toHaveBeenCalledWith('o1', 'UPI ref 998877'));
  });

  it('cancelling needs a reason and explains what happens to stock/refund', async () => {
    vi.mocked(ordersApi.cancel).mockResolvedValue(order('CANCELLED'));
    open(order('PAID'));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel order' }));
    const dlg = screen.getByRole('dialog', { name: 'Cancel order' });
    expect(within(dlg).getByText(/refund will be marked as due/i)).toBeInTheDocument();
    await userEvent.type(within(dlg).getByLabelText(/reason/i), 'Customer asked');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Cancel order' }));
    await waitFor(() => expect(ordersApi.cancel).toHaveBeenCalledWith('o1', 'Customer asked'));
  });

  it('renders customer-supplied gift text as plain text, never as markup', async () => {
    const { container } = open(order('PAID', { gift: { wrap: true, message: '<img src=x onerror=alert(1)>Happy birthday', engraving: 'PRIYA' } }));
    expect(await screen.findByText(/Happy birthday/)).toBeInTheDocument();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(screen.getByText('PRIYA')).toBeInTheDocument();
  });

  it('shows a way back if the order cannot be loaded', async () => {
    vi.mocked(ordersApi.detail).mockRejectedValue(new Error('boom'));
    renderPage(<OrderDetailPage />, { path: '/orders/:id', route: '/orders/o1' });
    expect(await screen.findByText(/could not load this order/i)).toBeInTheDocument();
  });
});
