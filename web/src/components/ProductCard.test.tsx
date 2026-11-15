import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useBag } from '@/store/cart.store';
import { card, renderAt, V50 } from '@/test/render';
import { ProductCard } from './ProductCard';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  useBag.setState({ lines: [] });
});

describe('ProductCard', () => {
  it('shows brand, name, family, size, price and badge, linking to the product page', () => {
    renderAt(<ProductCard p={card()} />);
    expect(screen.getByText('SmellMe Originals')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Saffron Dusk' })).toHaveAttribute('href', '/product/saffron-dusk');
    expect(screen.getByText('Amber · Spicy')).toBeInTheDocument();
    expect(screen.getByText('Eau de Parfum · 50 ml')).toBeInTheDocument();
    expect(screen.getByText('₹2,850')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('draws the illustrated bottle when there is no photo', () => {
    const { container } = renderAt(<ProductCard p={card({ image: null })} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('SD')).toBeInTheDocument();
  });

  it('shows the photo when there is one', () => {
    const { container } = renderAt(<ProductCard p={card({ image: 'https://cdn.test/media/x.webp' })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/media/x.webp');
  });

  it('adds the DEFAULT size to the bag with its display data, and then offers "Add another"', async () => {
    renderAt(<ProductCard p={card()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add to bag' }));
    expect(useBag.getState().lines).toEqual([
      expect.objectContaining({ variantId: V50, productSlug: 'saffron-dusk', label: '50 ml', price_paise: 285000, qty: 1, name: 'Saffron Dusk' }),
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Add another' }));
    expect(useBag.getState().lines[0].qty).toBe(2);
  });

  it('shows "Sold out" instead of a button when the default size has no stock', () => {
    renderAt(<ProductCard p={card({ default_variant: { id: V50, label: '50 ml', in_stock: false } })} />);
    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to bag|add another/i })).toBeNull();
  });

  it('cannot add anything when nothing is on sale', () => {
    renderAt(<ProductCard p={card({ default_variant: null })} />);
    expect(screen.queryByRole('button', { name: /add to bag|add another/i })).toBeNull();
    expect(useBag.getState().lines).toEqual([]);
  });
});
