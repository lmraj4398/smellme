import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { commerceApi } from '@/api/commerce';
import { NO_OPTIONS, useBag } from '@/store/cart.store';
import { useCustomerStore } from '@/store/customer.store';
import { currentUrl, renderAt, V50 } from '@/test/render';
import { bagLine, orderView, pLine, priced, savedAddress, settings } from '@/test/commerce';
import CheckoutPage, { checkoutRef, clearCheckoutRef } from './CheckoutPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/commerce', async (orig) => ({
  ...(await orig<typeof import('@/api/commerce')>()),
  commerceApi: { priceCart: vi.fn(), settings: vi.fn(), addresses: vi.fn(), createOrder: vi.fn(), saveAddress: vi.fn(), checkPincode: vi.fn() },
}));

const open = () => renderAt(<CheckoutPage />, { path: '/checkout', route: '/checkout' });
const place = () => userEvent.click(screen.getByRole('button', { name: 'Place order' }));
const lastOrder = () => vi.mocked(commerceApi.createOrder).mock.calls.at(-1)![0];

async function fillNew() {
  // The form starts pre-filled with the signed-in customer's name and number: replace them.
  await userEvent.clear(screen.getByLabelText('Full name'));
  await userEvent.type(screen.getByLabelText('Full name'), 'Anaya Rao');
  await userEvent.clear(screen.getByLabelText('Mobile number'));
  await userEvent.type(screen.getByLabelText('Mobile number'), '98765 43210');
  await userEvent.type(screen.getByLabelText(/Flat, house no/), '12 MG Road');
  await userEvent.type(screen.getByLabelText('City'), 'Bengaluru');
  await userEvent.selectOptions(screen.getByLabelText('State'), 'Karnataka');
  await userEvent.type(screen.getByLabelText('Pincode'), '560001');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useBag.setState({ lines: [bagLine()], options: NO_OPTIONS });
  useCustomerStore.setState({ customer: { id: 'c1', name: 'Anaya', phone: '+919876543210', email: '' }, token: 't', status: 'authed' });
  vi.mocked(commerceApi.priceCart).mockResolvedValue(priced());
  vi.mocked(commerceApi.settings).mockResolvedValue(settings);
  vi.mocked(commerceApi.addresses).mockResolvedValue([]);
  vi.mocked(commerceApi.createOrder).mockResolvedValue(orderView());
  vi.mocked(commerceApi.saveAddress).mockResolvedValue(savedAddress());
  vi.mocked(commerceApi.checkPincode).mockResolvedValue({ pincode: '560001', serviceable: true, eta_text: '3–7 working days' });
});

describe('CheckoutPage', () => {
  it('sends an empty bag back to the bag', () => {
    useBag.setState({ lines: [] });
    open();
    expect(currentUrl()).toBe('/bag');
  });

  it('with no saved address, shows the form pre-filled with their name and number', async () => {
    open();
    expect(await screen.findByLabelText('Full name')).toHaveValue('Anaya');
    expect(screen.getByLabelText('Mobile number')).toHaveValue('9876543210');
  });

  it('will not place an order until the address is complete, and points at what is wrong', async () => {
    open();
    await screen.findByLabelText('Full name');
    await userEvent.clear(screen.getByLabelText('Full name'));
    await userEvent.clear(screen.getByLabelText('Mobile number'));
    await place();
    expect(await screen.findByText('Please enter the name for delivery')).toBeInTheDocument();
    expect(screen.getByText('Enter a valid 10-digit mobile number')).toBeInTheDocument();
    expect(screen.getByText('Choose a state')).toBeInTheDocument();
    expect(commerceApi.createOrder).not.toHaveBeenCalled();
  });

  it('shows the delivery estimate when a pincode is entered', async () => {
    open();
    await screen.findByLabelText('Pincode');
    await userEvent.type(screen.getByLabelText('Pincode'), '560001');
    await userEvent.tab();
    expect(await screen.findByText('We deliver here · 3–7 working days')).toBeInTheDocument();
  });

  it('places the order with ids and quantities only (never a price), then empties the bag and opens the order', async () => {
    open();
    await screen.findByLabelText('Full name');
    await fillNew();
    await place();
    await waitFor(() => expect(commerceApi.createOrder).toHaveBeenCalledTimes(1));
    const body = lastOrder();
    expect(body.lines).toEqual([{ variant_id: V50, qty: 1 }]);
    expect(body.address).toEqual({ name: 'Anaya Rao', phone: '98765 43210', line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' });
    expect(body.client_ref).toMatch(/^[0-9a-f-]{36}$/);
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/price|total|paise|:111111[,}]/); // no price keys, and not the browser's (wrong) saved price either
    await waitFor(() => expect(currentUrl()).toBe('/order/SM-001001'));
    expect(useBag.getState().lines).toEqual([]);
    expect(sessionStorage.getItem('smellme-checkout-ref')).toBeNull();
  });

  it('uses the chosen saved address (the default one preselected) without asking again', async () => {
    vi.mocked(commerceApi.addresses).mockResolvedValue([savedAddress({ id: 'a2', is_default: false, line1: 'Office' }), savedAddress()]);
    open();
    expect(await screen.findByRole('radio', { name: /12 MG Road/ })).toBeChecked();
    expect(screen.queryByLabelText('Full name')).toBeNull();
    await place();
    await waitFor(() => expect(commerceApi.createOrder).toHaveBeenCalled());
    expect(lastOrder().address).toMatchObject({ line1: '12 MG Road', pincode: '560001' });
    expect(commerceApi.saveAddress).not.toHaveBeenCalled();
  });

  it('saves a new address for next time, but a failure to save never undoes the order', async () => {
    vi.mocked(commerceApi.saveAddress).mockRejectedValue(new Error('x'));
    open();
    await screen.findByLabelText('Full name');
    await fillNew();
    await place();
    await waitFor(() => expect(currentUrl()).toBe('/order/SM-001001'));
    expect(commerceApi.saveAddress).toHaveBeenCalledWith(null, expect.objectContaining({ pincode: '560001', is_default: true }));
  });

  it('includes the gift note and engraving only when gift wrap is on', async () => {
    useBag.setState({ options: { ...NO_OPTIONS, gift_wrap: true, gift_message: ' For Priya ', engraving: 'PRIYA' } });
    open();
    await screen.findByLabelText('Full name');
    await fillNew();
    await place();
    await waitFor(() => expect(commerceApi.createOrder).toHaveBeenCalled());
    expect(lastOrder()).toMatchObject({ gift_wrap: true, gift_message: 'For Priya', engraving: 'PRIYA' });

    vi.mocked(commerceApi.createOrder).mockClear();
    useBag.setState({ lines: [bagLine()], options: { ...NO_OPTIONS, gift_wrap: false, gift_message: 'leftover', engraving: 'LEFT' } });
    open();
    await screen.findAllByLabelText('Full name');
  });

  describe('retries and double clicks', () => {
    it('re-sends the SAME order reference after a failure, so a retry can never create a second order', async () => {
      vi.mocked(commerceApi.createOrder).mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK')).mockResolvedValue(orderView());
      open();
      await screen.findByLabelText('Full name');
      await fillNew();
      await place();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
      await place();
      await waitFor(() => expect(commerceApi.createOrder).toHaveBeenCalledTimes(2));
      const [a, b] = vi.mocked(commerceApi.createOrder).mock.calls.map((c) => c[0].client_ref);
      expect(a).toBe(b);
    });

    it('disables the button while placing, so a double-click sends one request', async () => {
      let release!: (o: ReturnType<typeof orderView>) => void;
      vi.mocked(commerceApi.createOrder).mockImplementation(() => new Promise((r) => { release = r; }));
      open();
      await screen.findByLabelText('Full name');
      await fillNew();
      const btn = screen.getByRole('button', { name: 'Place order' });
      await userEvent.dblClick(btn);
      expect(screen.getByRole('button', { name: /placing your order/i })).toBeDisabled();
      expect(commerceApi.createOrder).toHaveBeenCalledTimes(1);
      release(orderView());
      await waitFor(() => expect(currentUrl()).toBe('/order/SM-001001'));
    });

    it('checkoutRef: stable for the same bag, new for a different bag', () => {
      const a = checkoutRef('bag-A');
      expect(checkoutRef('bag-A')).toBe(a);
      expect(checkoutRef('bag-B')).not.toBe(a);
      clearCheckoutRef();
      expect(checkoutRef('bag-B')).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('survives a corrupted saved reference', () => {
      sessionStorage.setItem('smellme-checkout-ref', '{not json');
      expect(checkoutRef('x')).toMatch(/^[0-9a-f-]{36}$/);
      sessionStorage.setItem('smellme-checkout-ref', JSON.stringify({ ref: 'evil', sig: 'x' }));
      expect(checkoutRef('x')).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('when the order cannot be placed', () => {
    it('shows the server\'s reason (e.g. sold out) with a way back to the bag, and keeps the bag intact', async () => {
      vi.mocked(commerceApi.createOrder).mockRejectedValue(new AxiosError('409', '409', undefined, undefined, { status: 409, data: { message: 'Saffron Dusk 50 ml just sold out. Please review your bag.' }, statusText: '', headers: {}, config: {} as never }));
      open();
      await screen.findByLabelText('Full name');
      await fillNew();
      await place();
      expect(await screen.findByRole('alert')).toHaveTextContent('just sold out');
      expect(screen.getByRole('link', { name: 'Review your bag' })).toHaveAttribute('href', '/bag');
      expect(useBag.getState().lines).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Place order' })).toBeEnabled();
    });

    it('will not even try while the bag has a stock problem', async () => {
      vi.mocked(commerceApi.priceCart).mockResolvedValue(priced({ issues: [pLine({ issue: 'insufficient_stock', available: 0 })], lines: [pLine({ issue: 'insufficient_stock', available: 0 })] }));
      open();
      await screen.findByLabelText('Full name');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Place order' })).toBeDisabled());
    });
  });

  it('shows the amount to pay from the server', async () => {
    vi.mocked(commerceApi.priceCart).mockResolvedValue(priced({ gift_wrap_paise: 15000, total_paise: 300000 }));
    open();
    expect(await screen.findByText('₹3,000')).toBeInTheDocument();
    expect(screen.getByText('Total to pay')).toBeInTheDocument();
  });
});
