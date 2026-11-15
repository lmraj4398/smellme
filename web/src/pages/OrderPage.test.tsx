import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { commerceApi } from '@/api/commerce';
import { renderAt } from '@/test/render';
import { orderView } from '@/test/commerce';
import OrderPage from './OrderPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/commerce', async (orig) => ({
  ...(await orig<typeof import('@/api/commerce')>()),
  commerceApi: { order: vi.fn(), presignReceipt: vi.fn(), submitReceipt: vi.fn(), cancelOrder: vi.fn() },
}));

const open = () => renderAt(<OrderPage />, { path: '/order/:orderNo', route: '/order/SM-001001' });
const png = (size = 2048, type = 'image/png', name = 'receipt.png') => new File([new Uint8Array(size)], name, { type });
const upload = (file: File) => userEvent.upload(screen.getByLabelText(/payment screenshot or pdf/i), file, { applyAccept: false });
const send = () => userEvent.click(screen.getByRole('button', { name: /i’ve paid/i }));

const put = vi.fn();
beforeEach(() => {
  vi.mocked(commerceApi.order).mockResolvedValue(orderView());
  vi.mocked(commerceApi.presignReceipt).mockResolvedValue({ key: 'receipts/o/k.png', upload_url: 'https://private.r2/upload?sig=1', headers: { 'Content-Type': 'image/png' }, expires_in: 300 });
  vi.mocked(commerceApi.submitReceipt).mockResolvedValue(orderView({ status: 'PAYMENT_SUBMITTED', payment: null, payment_submitted: true, can_cancel: false, can_upload_receipt: false }));
  put.mockReset().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', put);
});
afterEach(() => vi.unstubAllGlobals());

describe('OrderPage: paying', () => {
  it('shows the QR, the EXACT amount, the UPI id and a clear warning that the QR has no amount', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Waiting for your payment' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /upi qr code/i })).toBeInTheDocument();
    const pay = screen.getByRole('region', { name: 'Pay by UPI' });
    expect(within(pay).getAllByText('₹2,850').length).toBeGreaterThan(0);
    expect(within(pay).getByText('smellme@okhdfcbank')).toBeInTheDocument();
    expect(within(pay).getByRole('note')).toHaveTextContent(/pay exactly ₹2,850/i);
    expect(within(pay).getByRole('note')).toHaveTextContent(/doesn’t fill in the amount/i);
  });

  it('encodes the UPI link from the server into the QR, and never an amount', async () => {
    const { container } = open();
    await screen.findByRole('img', { name: /upi qr code/i });
    expect(container.querySelector('svg')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open UPI app' });
    expect(link).toHaveAttribute('href', expect.stringMatching(/^upi:\/\/pay\?pa=smellme%40okhdfcbank/));
    expect(link.getAttribute('href')).not.toMatch(/[?&]am=/);
  });

  it('copies the UPI id', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    open();
    await userEvent.click(await screen.findByRole('button', { name: /copy/i }));
    expect(writeText).toHaveBeenCalledWith('smellme@okhdfcbank');
    expect(await screen.findByText('Copied')).toBeInTheDocument();
  });

  it('says payment is unavailable (rather than showing a broken QR) when no UPI id is set up', async () => {
    vi.mocked(commerceApi.order).mockResolvedValue(orderView({ payment: { unavailable: true } }));
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent(/isn’t set up/);
    expect(screen.queryByRole('img', { name: /upi qr/i })).toBeNull();
  });
});

describe('OrderPage: uploading the receipt', () => {
  it('uploads straight to the signed URL with exactly the signed headers, then confirms it with the API', async () => {
    open();
    await screen.findByRole('img', { name: /upi qr code/i });
    await upload(png());
    await userEvent.type(screen.getByLabelText(/payment reference/i), 'ab1234567890');
    await send();
    await waitFor(() => expect(commerceApi.submitReceipt).toHaveBeenCalled());
    expect(commerceApi.presignReceipt).toHaveBeenCalledWith('SM-001001', 'image/png', 2048);
    expect(put).toHaveBeenCalledWith('https://private.r2/upload?sig=1', expect.objectContaining({ method: 'PUT', headers: { 'Content-Type': 'image/png' } }));
    expect(commerceApi.submitReceipt).toHaveBeenCalledWith('SM-001001', { key: 'receipts/o/k.png', utr: 'ab1234567890', paid_amount_paise: 285000 });
    expect(await screen.findByRole('heading', { name: 'We’re checking your payment' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /upi qr/i })).toBeNull(); // nothing left to pay
  });

  it('the reference is optional, and the paid amount is sent in exact paise', async () => {
    open();
    await screen.findByRole('img', { name: /upi qr code/i });
    await upload(png());
    const paid = screen.getByLabelText(/amount you paid/i);
    await userEvent.clear(paid);
    await userEvent.type(paid, '2,850.50');
    await send();
    await waitFor(() => expect(commerceApi.submitReceipt).toHaveBeenCalledWith('SM-001001', { key: 'receipts/o/k.png', paid_amount_paise: 285050 }));
  });

  it.each([
    ['no file chosen', null, /choose your payment screenshot/i],
    ['the wrong kind of file', png(100, 'image/svg+xml', 'x.svg'), /photo or screenshot/i],
    ['a file that is too big', png(6 * 1024 * 1024), /over 5 MB/i],
    ['an empty file', png(0), /empty/i],
  ])('refuses %s without contacting the server', async (_n, file, msg) => {
    open();
    await screen.findByRole('img', { name: /upi qr code/i });
    if (file) await upload(file);
    await send();
    expect(await screen.findByRole('alert')).toHaveTextContent(msg);
    expect(commerceApi.presignReceipt).not.toHaveBeenCalled();
  });

  it('rejects a malformed reference or amount before uploading anything', async () => {
    open();
    await screen.findByRole('img', { name: /upi qr code/i });
    await upload(png());
    await userEvent.type(screen.getByLabelText(/payment reference/i), 'x y');
    await send();
    expect(await screen.findByRole('alert')).toHaveTextContent(/6-30 letters or numbers/);
    await userEvent.clear(screen.getByLabelText(/payment reference/i));
    const paid = screen.getByLabelText(/amount you paid/i);
    await userEvent.clear(paid);
    await userEvent.type(paid, 'abc');
    await send();
    expect(await screen.findByRole('alert')).toHaveTextContent(/enter the amount/i);
    expect(commerceApi.presignReceipt).not.toHaveBeenCalled();
  });

  it('if the upload to storage fails, says so and does NOT tell the server a receipt exists', async () => {
    put.mockResolvedValue({ ok: false, status: 403 });
    open();
    await screen.findByRole('img', { name: /upi qr code/i });
    await upload(png());
    await send();
    expect(await screen.findByRole('alert')).toHaveTextContent(/upload didn’t go through/i);
    expect(commerceApi.submitReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /i’ve paid/i })).toBeEnabled(); // they can try again
  });

  it('shows the server\'s message if confirming fails', async () => {
    vi.mocked(commerceApi.submitReceipt).mockRejectedValue(new AxiosError('400', '400', undefined, undefined, { status: 400, data: { message: 'We couldn’t find your upload. Please upload the receipt again.' }, statusText: '', headers: {}, config: {} as never }));
    open();
    await screen.findByRole('img', { name: /upi qr code/i });
    await upload(png());
    await send();
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t find your upload/);
  });
});

describe('OrderPage: every state of an order', () => {
  it('after a rejection, explains why and invites a new receipt', async () => {
    vi.mocked(commerceApi.order).mockResolvedValue(orderView({ payment_reject_reason: 'The amount received was ₹2,500' }));
    open();
    expect(await screen.findByText('We couldn’t confirm your last payment')).toBeInTheDocument();
    expect(screen.getByText('The amount received was ₹2,500')).toBeInTheDocument();
    expect(screen.getByLabelText(/payment screenshot or pdf/i)).toBeInTheDocument();
  });

  it('shows tracking once shipped, with progress ticks, and no payment or cancel controls', async () => {
    vi.mocked(commerceApi.order).mockResolvedValue(orderView({
      status: 'SHIPPED', payment: null, can_cancel: false, can_upload_receipt: false,
      shipping: { carrier: 'DTDC', tracking_no: 'D1234567', shipped_at: '2026-10-22T10:00:00Z' },
      timeline: { placed: '2026-10-21T10:00:00Z', payment_submitted: 'x', paid: '2026-10-21T11:00:00Z', packed: '2026-10-21T12:00:00Z', shipped: '2026-10-22T10:00:00Z', delivered: null, cancelled: null },
    }));
    open();
    expect(await screen.findByRole('heading', { name: 'On its way' })).toBeInTheDocument();
    expect(screen.getByText('D1234567')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Order progress' })).getAllByLabelText('done')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull();
    expect(screen.queryByLabelText(/payment screenshot/i)).toBeNull();
  });

  it('a cancelled order shows the reason and, if it was paid, that a refund is coming', async () => {
    vi.mocked(commerceApi.order).mockResolvedValue(orderView({ status: 'CANCELLED', cancel_reason: 'Out of packaging', refund_due: true, payment: null, can_cancel: false }));
    open();
    expect(await screen.findByRole('heading', { name: 'Cancelled' })).toBeInTheDocument();
    expect(screen.getByText(/Reason: Out of packaging/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/refund ₹2,850/);
    expect(screen.queryByRole('list', { name: 'Order progress' })).toBeNull();
  });

  it('lets the customer cancel only an unpaid order, after confirming', async () => {
    vi.mocked(commerceApi.cancelOrder).mockResolvedValue(orderView({ status: 'CANCELLED', payment: null, can_cancel: false }));
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    open();
    const cancel = await screen.findByRole('button', { name: 'Cancel this order' });
    await userEvent.click(cancel);
    expect(commerceApi.cancelOrder).not.toHaveBeenCalled();
    await userEvent.click(cancel);
    await waitFor(() => expect(commerceApi.cancelOrder).toHaveBeenCalledWith('SM-001001'));
    expect(await screen.findByRole('heading', { name: 'Cancelled' })).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('lists items, free samples, totals and the delivery address', async () => {
    vi.mocked(commerceApi.order).mockResolvedValue(orderView({
      items: [
        { name: 'Saffron Dusk', brand: 'B', label: '50 ml', qty: 1, unit_price_paise: 285000, line_total_paise: 285000, is_free_sample: false, product_slug: 's' },
        { name: 'Rose Velours', brand: 'B', label: '2 ml sample', qty: 1, unit_price_paise: 0, line_total_paise: 0, is_free_sample: true, product_slug: 'r' },
      ],
    }));
    open();
    expect(await screen.findByText(/Rose Velours/)).toBeInTheDocument();
    expect(screen.getAllByText('Free').length).toBeGreaterThanOrEqual(1); // the free sample (and free delivery)
    expect(screen.getByText(/12 MG Road/)).toBeInTheDocument();
  });

  it('shows a friendly page for an order that is not theirs (404), and an error with retry otherwise', async () => {
    vi.mocked(commerceApi.order).mockRejectedValue(new AxiosError('404', '404', undefined, undefined, { status: 404, data: {}, statusText: '', headers: {}, config: {} as never }));
    const { unmount } = open();
    expect(await screen.findByRole('heading', { name: 'Order not found' })).toBeInTheDocument();
    unmount();
    vi.mocked(commerceApi.order).mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(orderView());
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }, { timeout: 8000 }));
    expect(await screen.findByRole('heading', { name: 'Waiting for your payment' })).toBeInTheDocument();
  }, 20000);
});
