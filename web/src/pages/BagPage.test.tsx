import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { commerceApi } from '@/api/commerce';
import { NO_OPTIONS, useBag } from '@/store/cart.store';
import { currentUrl, renderAt, V100, V50 } from '@/test/render';
import { bagLine, pLine, priced, settings } from '@/test/commerce';
import BagPage from './BagPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/commerce', async (orig) => ({ ...(await orig<typeof import('@/api/commerce')>()), commerceApi: { priceCart: vi.fn(), settings: vi.fn(), samples: vi.fn() } }));

const S1 = '55555555-5555-4555-8555-555555555555';
const S2 = '66666666-6666-4666-8666-666666666666';
const S3 = '77777777-7777-4777-8777-777777777777';
const samples = [S1, S2, S3].map((id, i) => ({ variant_id: id, product_name: `Sample ${i + 1}`, brand: 'B', label: '2 ml sample', tint: '#eee', liquid: '#ccc', mono: 'S' }));
const lastInput = () => vi.mocked(commerceApi.priceCart).mock.calls.at(-1)![0];

beforeEach(() => {
  localStorage.clear();
  useBag.setState({ lines: [bagLine()], options: NO_OPTIONS });
  vi.mocked(commerceApi.priceCart).mockResolvedValue(priced());
  vi.mocked(commerceApi.settings).mockResolvedValue(settings);
  vi.mocked(commerceApi.samples).mockResolvedValue(samples);
});

const open = () => renderAt(<BagPage />, { path: '/bag', route: '/bag' });

describe('BagPage', () => {
  it('shows an inviting empty state', () => {
    useBag.setState({ lines: [] });
    open();
    expect(screen.getByRole('heading', { name: 'Your bag is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/shop');
    expect(commerceApi.priceCart).not.toHaveBeenCalled();
  });

  it('shows the SERVER price, not the (wrong) price saved in the browser', async () => {
    open();
    expect((await screen.findAllByText('₹2,850')).length).toBeGreaterThanOrEqual(2); // line total + subtotal
    expect(document.body.textContent).not.toContain('1,111');
  });

  it('sends the server only ids and quantities', async () => {
    open();
    await screen.findByText('Summary');
    await waitFor(() => expect(commerceApi.priceCart).toHaveBeenCalled());
    expect(lastInput()).toEqual({ lines: [{ variant_id: V50, qty: 1 }] });
  });

  it('changing the quantity re-prices from the server', async () => {
    vi.mocked(commerceApi.priceCart).mockImplementation(async (b) => priced({ lines: [pLine({ qty: b.lines[0].qty, line_total_paise: 285000 * b.lines[0].qty })], subtotal_paise: 285000 * b.lines[0].qty, total_paise: 285000 * b.lines[0].qty }));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Increase' }));
    expect(lastInput().lines[0].qty).toBe(2);
    expect(await screen.findAllByText('₹5,700')).not.toHaveLength(0);
    expect(useBag.getState().lines[0].qty).toBe(2);
  });

  it('removes a line, ending on the empty state', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: /^Remove$/ }));
    expect(useBag.getState().lines).toEqual([]);
    expect(screen.getByRole('heading', { name: 'Your bag is empty' })).toBeInTheDocument();
  });

  it('shows how close they are to free delivery, and when they have it', async () => {
    vi.mocked(commerceApi.priceCart).mockResolvedValue(priced({ lines: [pLine({ unit_price_paise: 145000, line_total_paise: 145000 })], subtotal_paise: 145000, delivery_fee_paise: 9900, total_paise: 154900 }));
    open();
    expect(await screen.findByText('Add ₹550 more for free delivery.')).toBeInTheDocument();
    expect(screen.getByText('₹99')).toBeInTheDocument();
  });

  it('says so when delivery is free', async () => {
    open();
    expect(await screen.findByText('You’ve unlocked free delivery.')).toBeInTheDocument();
    expect(screen.getAllByText('Free').length).toBeGreaterThan(0);
  });

  describe('stock problems', () => {
    it('explains a size with too little stock, offers a one-click fix, and blocks checkout until it is fixed', async () => {
      useBag.setState({ lines: [bagLine({ variantId: V100, label: '100 ml', qty: 3 })] });
      vi.mocked(commerceApi.priceCart).mockResolvedValue(priced({ lines: [pLine({ variant_id: V100, label: '100 ml', qty: 3, issue: 'insufficient_stock', available: 2 })], issues: [pLine({ variant_id: V100, issue: 'insufficient_stock', available: 2 })], subtotal_paise: 0, total_paise: 0 }));
      open();
      expect(await screen.findByRole('alert')).toHaveTextContent('Only 2 left.');
      expect(screen.getByRole('button', { name: /fix the items above/i })).toBeDisabled();
      await userEvent.click(screen.getByRole('button', { name: 'Reduce to 2' }));
      expect(useBag.getState().lines[0].qty).toBe(2);
    });

    it('offers only "Remove" for an item that is gone', async () => {
      vi.mocked(commerceApi.priceCart).mockResolvedValue(priced({ lines: [pLine({ issue: 'unavailable' })], issues: [pLine({ issue: 'unavailable' })], subtotal_paise: 0, total_paise: 0 }));
      open();
      expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
      expect(screen.queryByRole('button', { name: /reduce to/i })).toBeNull();
    });
  });

  describe('coupon', () => {
    it('applies a code (kept in the bag options) and shows the discount from the server', async () => {
      vi.mocked(commerceApi.priceCart).mockImplementation(async (b) => priced(b.coupon_code ? { discount_paise: 28500, total_paise: 256500, coupon: { code: 'TEN', description: '' } } : {}));
      open();
      await userEvent.type(await screen.findByLabelText('Coupon code'), 'ten');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(await screen.findByText('− ₹285')).toBeInTheDocument();
      expect(screen.getByText(/“TEN” applied/)).toBeInTheDocument();
      expect(lastInput().coupon_code).toBe('ten');
    });

    it('shows why a code was refused, and lets them remove it', async () => {
      vi.mocked(commerceApi.priceCart).mockImplementation(async (b) => priced(b.coupon_code ? { coupon_error: 'This coupon isn’t valid' } : {}));
      open();
      await userEvent.type(await screen.findByLabelText('Coupon code'), 'nope');
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
      expect(await screen.findByText('This coupon isn’t valid')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Checkout securely' })).toBeEnabled(); // a bad code doesn't block the order
    });
  });

  describe('free samples', () => {
    it('lets them choose up to the allowed number and no more', async () => {
      open();
      const s1 = await screen.findByRole('button', { name: /Sample 1/ });
      await userEvent.click(s1);
      await userEvent.click(screen.getByRole('button', { name: /Sample 2/ }));
      expect(screen.getByText('2 of 2 chosen')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sample 3/ })).toBeDisabled();
      expect(useBag.getState().options.free_sample_ids).toEqual([S1, S2]);
      await userEvent.click(s1); // deselect makes room again
      expect(screen.getByRole('button', { name: /Sample 3/ })).toBeEnabled();
      await waitFor(() => expect(lastInput().free_sample_ids).toEqual([S2]));
    });

    it('is not shown when the owner has turned free samples off', async () => {
      vi.mocked(commerceApi.settings).mockResolvedValue({ ...settings, free_samples_count: 0 });
      vi.mocked(commerceApi.priceCart).mockResolvedValue(priced({ free_samples_allowed: 0 }));
      open();
      await screen.findByText('Summary');
      await waitFor(() => expect(screen.queryByRole('region', { name: 'Free samples' })).toBeNull());
    });
  });

  describe('gift options', () => {
    it('reveals the message and engraving only when gift wrap is ticked, and sends gift_wrap to the server', async () => {
      open();
      expect(screen.queryByLabelText(/Gift message/)).toBeNull();
      await userEvent.click(await screen.findByRole('checkbox', { name: /gift wrap/i }));
      expect(screen.getByLabelText(/Gift message/)).toBeInTheDocument();
      await waitFor(() => expect(lastInput().gift_wrap).toBe(true));
    });

    it('limits the engraving to 14 safe characters', async () => {
      open();
      await userEvent.click(await screen.findByRole('checkbox', { name: /gift wrap/i }));
      const eng = screen.getByLabelText(/Engraving/);
      await userEvent.type(eng, 'Priya <3 #1 & Co. forever');
      const e = useBag.getState().options.engraving;
      expect(e).toMatch(/^[A-Za-z0-9 .'&-]{0,14}$/); // never longer than 14, never an unsafe character
      expect(e.startsWith('Priya')).toBe(true);
      expect(e).not.toMatch(/[<>#]/);
    });
  });

  it('goes to checkout when everything is fine', async () => {
    open();
    const go = await screen.findByRole('button', { name: 'Checkout securely' });
    await waitFor(() => expect(go).toBeEnabled());
    await userEvent.click(go);
    expect(currentUrl()).toBe('/checkout');
  });

  it('shows an error with retry if prices cannot be checked, and does not let them check out blind', async () => {
    vi.mocked(commerceApi.priceCart).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(priced());
    open();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    expect(screen.getByRole('button', { name: 'Checkout securely' })).toBeDisabled();
    await userEvent.click(retry);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Checkout securely' })).toBeEnabled());
    expect(within(document.body).queryByText('We couldn’t load this')).toBeNull();
  });
});
