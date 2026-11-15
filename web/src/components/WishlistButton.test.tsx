import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { wishlistApi } from '@/api/wishlist';
import { useCustomerStore } from '@/store/customer.store';
import { currentUrl, renderAt } from '@/test/render';
import { WishlistButton } from './WishlistButton';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/wishlist', () => ({ wishlistApi: { ids: vi.fn(), list: vi.fn(), add: vi.fn(), remove: vi.fn() } }));

const me = { id: 'c1', name: 'Anaya', phone: '+919876543210', email: '' };
const open = () => renderAt(<WishlistButton productId="p1" name="Saffron Dusk" />, { path: '/shop', route: '/shop?family=amber' });

// A tiny stand-in for the server, so the refetch after a click sees the change like it would for real.
let saved: string[];
const serve = (initial: string[]) => {
  saved = [...initial];
  vi.mocked(wishlistApi.ids).mockImplementation(async () => [...saved]);
  vi.mocked(wishlistApi.add).mockImplementation(async (id) => { saved = [id, ...saved]; return { ok: true }; });
  vi.mocked(wishlistApi.remove).mockImplementation(async (id) => { saved = saved.filter((x) => x !== id); return { ok: true }; });
};

beforeEach(() => {
  useCustomerStore.setState({ customer: me, token: 't', status: 'authed' });
  serve([]);
});

describe('WishlistButton', () => {
  it('shows an empty heart, and a filled one for a product already saved', async () => {
    serve(['p1']);
    open();
    expect(await screen.findByRole('button', { name: 'Remove Saffron Dusk from wishlist' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds a product on click, updating the heart at once', async () => {
    open();
    const btn = await screen.findByRole('button', { name: 'Add Saffron Dusk to wishlist' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    expect(await screen.findByRole('button', { name: 'Remove Saffron Dusk from wishlist' })).toBeInTheDocument();
    expect(wishlistApi.add).toHaveBeenCalledWith('p1');
  });

  it('removes a saved product on click', async () => {
    serve(['p1']);
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Saffron Dusk from wishlist' }));
    expect(await screen.findByRole('button', { name: 'Add Saffron Dusk to wishlist' })).toBeInTheDocument();
    expect(wishlistApi.remove).toHaveBeenCalledWith('p1');
  });

  it('puts the heart back and says why when the server refuses', async () => {
    vi.mocked(wishlistApi.add).mockRejectedValue(new Error('boom'));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Saffron Dusk to wishlist' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Add Saffron Dusk to wishlist' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('sends a signed-out shopper to sign in, then back to the same page', async () => {
    useCustomerStore.setState({ customer: null, token: null, status: 'anon' });
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Add Saffron Dusk to wishlist' }));
    expect(currentUrl()).toBe('/login?next=%2Fshop%3Ffamily%3Damber');
    expect(wishlistApi.ids).not.toHaveBeenCalled();
    expect(wishlistApi.add).not.toHaveBeenCalled();
  });
});
