import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { wishlistApi } from '@/api/wishlist';
import { commerceApi } from '@/api/commerce';
import { useCustomerStore } from '@/store/customer.store';
import { card, renderAt } from '@/test/render';
import AccountPage from './AccountPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/wishlist', () => ({ wishlistApi: { ids: vi.fn(), list: vi.fn(), add: vi.fn(), remove: vi.fn() } }));
vi.mock('@/api/commerce', async (orig) => ({
  ...(await orig<typeof import('@/api/commerce')>()),
  commerceApi: { orders: vi.fn(), addresses: vi.fn(), settings: vi.fn(), logout: vi.fn(), scentProfile: vi.fn() },
}));

const open = (route = '/account?tab=wishlist') => renderAt(<AccountPage />, { path: '/account', route });

beforeEach(() => {
  useCustomerStore.setState({ customer: { id: 'c1', name: 'Anaya Rao', phone: '+919876543210', email: '' }, token: 't', status: 'authed' });
  vi.mocked(commerceApi.orders).mockResolvedValue({ total: 0, items: [] });
  vi.mocked(commerceApi.scentProfile).mockResolvedValue([]);
  vi.mocked(wishlistApi.ids).mockResolvedValue(['p1']);
  vi.mocked(wishlistApi.list).mockResolvedValue([card({ id: 'p1', slug: 'saffron-dusk', name: 'Saffron Dusk' })]);
});

describe('Account wishlist tab', () => {
  it('opens straight to the wishlist from ?tab=wishlist and shows saved fragrances as cards', async () => {
    open();
    expect(await screen.findByRole('heading', { name: 'Wishlist' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Saffron Dusk' })).toHaveAttribute('href', '/product/saffron-dusk');
    expect(screen.getByRole('button', { name: 'Remove Saffron Dusk from wishlist' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('shows an empty state with a way to start browsing', async () => {
    vi.mocked(wishlistApi.list).mockResolvedValue([]);
    open();
    expect(await screen.findByText(/Nothing saved yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse fragrances' })).toHaveAttribute('href', '/shop');
  });

  it('is reachable from the account tabs, and unknown ?tab= values fall back to the overview', async () => {
    open('/account?tab=nonsense');
    expect(await screen.findByRole('region', { name: 'Your scent profile' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Wishlist' }));
    expect(await screen.findByRole('link', { name: 'Saffron Dusk' })).toBeInTheDocument();
  });
});
