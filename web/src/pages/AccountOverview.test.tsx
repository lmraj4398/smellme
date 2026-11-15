import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { commerceApi } from '@/api/commerce';
import { wishlistApi } from '@/api/wishlist';
import { useCustomerStore } from '@/store/customer.store';
import { card, renderAt } from '@/test/render';
import AccountPage from './AccountPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/wishlist', () => ({ wishlistApi: { ids: vi.fn(), list: vi.fn(), add: vi.fn(), remove: vi.fn() } }));
vi.mock('@/api/commerce', async (orig) => ({
  ...(await orig<typeof import('@/api/commerce')>()),
  commerceApi: { orders: vi.fn(), addresses: vi.fn(), settings: vi.fn(), logout: vi.fn(), scentProfile: vi.fn(), updateMe: vi.fn() },
}));

const me = { id: 'c1', name: 'Anaya Rao', phone: '+919876543210', email: '', birthday: null as string | null };
const order = (n: number) => ({ order_no: `SM-00100${n}`, status: 'DELIVERED', created_at: '2026-10-01T10:00:00Z', total_paise: 285000, items: [{ name: `Scent ${n}`, label: '50 ml', qty: 1 }] });
const open = (route = '/account') => renderAt(<AccountPage />, { path: '/account', route });

beforeEach(() => {
  useCustomerStore.setState({ customer: me, token: 't', status: 'authed' });
  vi.mocked(commerceApi.orders).mockResolvedValue({ total: 3, items: [order(3), order(2), order(1)] });
  vi.mocked(commerceApi.scentProfile).mockResolvedValue([
    { name: 'Amber', slug: 'amber', qty: 4, share: 1 }, { name: 'Woody', slug: 'woody', qty: 2, share: 0.5 }, { name: 'Floral', slug: 'floral', qty: 1, share: 0.25 },
  ]);
  vi.mocked(wishlistApi.ids).mockResolvedValue([]);
  vi.mocked(wishlistApi.list).mockResolvedValue([card({ id: 'p1', slug: 'oud-ivoire', name: 'Oud Ivoire' })]);
  vi.mocked(commerceApi.updateMe).mockImplementation(async (b) => ({ ...me, ...b, birthday: b.birthday || null }));
});

describe('Account overview', () => {
  it('is the page the account opens on', async () => {
    open();
    expect(await screen.findByRole('region', { name: 'Your scent profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows the families the customer buys, how much they like each, and where to go next', async () => {
    open();
    const profile = await screen.findByRole('region', { name: 'Your scent profile' });
    const list = within(profile).getByRole('list', { name: 'Scent families' });
    expect(within(list).getByText('Amber').closest('li')).toHaveTextContent('Loves');
    expect(within(list).getByText('Woody').closest('li')).toHaveTextContent('Likes');
    expect(within(list).getByText('Floral').closest('li')).toHaveTextContent('Sometimes');
    expect(within(profile).getByText(/Amber & woody/)).toBeInTheDocument();
    expect(within(profile).getByRole('link', { name: 'See picks for you' })).toHaveAttribute('href', '/shop?family=amber');
    expect(within(profile).getByRole('link', { name: 'Take the quiz' })).toHaveAttribute('href', '/scent-finder');
  });

  it('invites a customer with no orders to take the quiz', async () => {
    vi.mocked(commerceApi.scentProfile).mockResolvedValue([]);
    open();
    expect(await screen.findByRole('link', { name: 'Take the scent quiz' })).toHaveAttribute('href', '/scent-finder');
    expect(screen.queryByRole('list', { name: 'Scent families' })).toBeNull();
  });

  it('leaves the profile out when it cannot be loaded, without breaking the rest', async () => {
    vi.mocked(commerceApi.scentProfile).mockRejectedValue(new Error('down'));
    open();
    expect(await screen.findByRole('region', { name: 'Recent orders' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Your scent profile' })).toBeNull();
  });

  it('shows the two most recent orders and the first saved fragrances, each with a way to see them all', async () => {
    open();
    const recent = await screen.findByRole('region', { name: 'Recent orders' });
    expect(within(recent).getAllByRole('link')).toHaveLength(2);
    expect(within(recent).getByText(/SM-001003/)).toBeInTheDocument();
    expect(within(recent).queryByText(/SM-001001/)).toBeNull();
    const saved = await screen.findByRole('region', { name: 'Saved fragrances' });
    expect(within(saved).getByRole('link', { name: 'Oud Ivoire' })).toBeInTheDocument();

    await userEvent.click(within(recent).getByRole('button', { name: 'All orders' }));
    expect(await screen.findByRole('heading', { name: 'Your orders' })).toBeInTheDocument();
  });

  it('can open the wishlist from the overview', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'View wishlist' }));
    expect(await screen.findByRole('heading', { name: 'Wishlist' })).toBeInTheDocument();
  });
});

describe('Account details: birthday', () => {
  const details = async () => {
    open('/account?tab=details');
    return screen.findByLabelText(/Birthday/);
  };

  it('starts empty, with the promise it is for', async () => {
    const input = await details();
    expect(input).toHaveValue('');
    expect(screen.getByText(/free sample around your birthday/)).toBeInTheDocument();
    expect(input).toHaveAttribute('max');
  });

  it('shows a saved birthday', async () => {
    useCustomerStore.setState({ customer: { ...me, birthday: '1994-08-21' } });
    expect(await details()).toHaveValue('1994-08-21');
  });

  it('saves a birthday with the rest of the details', async () => {
    const input = await details();
    await userEvent.type(input, '1994-08-21');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commerceApi.updateMe).toHaveBeenCalledWith({ name: 'Anaya Rao', birthday: '1994-08-21' }));
    expect(useCustomerStore.getState().customer?.birthday).toBe('1994-08-21');
  });
});
