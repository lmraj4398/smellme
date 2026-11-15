import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { catalogApi } from '@/api/catalog';
import { useBag } from '@/store/cart.store';
import { detail, renderAt, V100, V2, V50 } from '@/test/render';
import ProductPage from './ProductPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/reviews', () => ({ reviewsApi: { list: vi.fn().mockResolvedValue({ summary: { count: 0, average: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } }, page: 1, limit: 10, items: [] }), mine: vi.fn(), save: vi.fn(), remove: vi.fn() } }));
vi.mock('@/api/catalog', async (orig) => ({ ...(await orig<typeof import('@/api/catalog')>()), catalogApi: { product: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  useBag.setState({ lines: [] });
  vi.mocked(catalogApi.product).mockResolvedValue(detail());
});

const open = () => renderAt(<ProductPage />, { path: '/product/:slug', route: '/product/saffron-dusk' });
const size = (name: RegExp | string) => screen.getByRole('button', { name: new RegExp(typeof name === 'string' ? name : name.source) });

describe('ProductPage', () => {
  it('shows the product, with the DEFAULT size preselected and its price', async () => {
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Saffron Dusk' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^50 ml/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('₹2,850', { selector: 'span.font-serif' })).toBeInTheDocument();
    expect(screen.getByText('₹3,100')).toBeInTheDocument(); // MRP, struck through
    expect(screen.getByRole('button', { name: 'Add to bag · ₹2,850' })).toBeEnabled();
  });

  it('has exactly one "check delivery" box, between the buy buttons and the details', async () => {
    open();
    await screen.findByRole('heading', { level: 1, name: 'Saffron Dusk' });
    const boxes = screen.getAllByLabelText('Check delivery to your pincode');
    expect(boxes).toHaveLength(1);
    const addToBag = screen.getByRole('button', { name: 'Add to bag · ₹2,850' });
    const story = screen.getByText('The story');
    expect(addToBag.compareDocumentPosition(boxes[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(boxes[0].compareDocumentPosition(story) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('switching size changes the price and what gets added to the bag', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(size(/^2 ml sample/));
    expect(screen.getByRole('button', { name: 'Add to bag · ₹190' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /^Add to bag ·/ }));
    expect(useBag.getState().lines).toEqual([expect.objectContaining({ variantId: V2, label: '2 ml sample', price_paise: 19000, qty: 1 })]);
  });

  it('quantity changes the total and the bag quantity, within 1–9', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    const dec = screen.getByRole('button', { name: 'Decrease quantity' });
    expect(dec).toBeDisabled();
    for (let i = 0; i < 3; i++) await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByRole('button', { name: 'Add to bag · ₹11,400' })).toBeInTheDocument(); // 4 x 2,850
    await userEvent.click(screen.getByRole('button', { name: /^Add to bag ·/ }));
    expect(useBag.getState().lines[0]).toMatchObject({ variantId: V50, qty: 4 });
    for (let i = 0; i < 10; i++) await userEvent.click(screen.getByRole('button', { name: 'Increase quantity' }));
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
  });

  it('a sold-out size can be seen but not bought', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    await userEvent.click(size(/^100 ml/));
    const buy = screen.getByRole('button', { name: 'Sold out' });
    expect(buy).toBeDisabled();
    await userEvent.click(buy);
    expect(useBag.getState().lines).toEqual([]);
    expect(V100).toBeTruthy();
  });

  it('warns when a size is nearly gone', async () => {
    vi.mocked(catalogApi.product).mockResolvedValue(detail({ variants: detail().variants.map((v) => (v.is_default ? { ...v, low_stock: true } : v)) }));
    open();
    expect(await screen.findByText('Only a few left in this size.')).toBeInTheDocument();
  });

  it('renders the notes pyramid in tier order, the scent meters and related products', async () => {
    open();
    await screen.findByRole('heading', { level: 1 });
    const tiers = screen.getAllByText(/^(Top|Heart|Base) notes$/).map((e) => e.textContent);
    expect(tiers).toEqual(['Top notes', 'Base notes']); // heart omitted: no notes in that tier
    expect(screen.getByText('Saffron')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Longevity: 8–10 hours' })).toBeInTheDocument();
    expect(screen.getByText('Oud Ivoire')).toBeInTheDocument();
  });

  it('only shows description blocks that have text, rendered as plain text', async () => {
    vi.mocked(catalogApi.product).mockResolvedValue(detail({ story: '', ingredients: '<script>alert(1)</script>' }));
    const { container } = open();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('The story')).toBeNull();
    expect(screen.getByText('How to wear it')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });

  it('uses the photos when there are some, with working thumbnails', async () => {
    vi.mocked(catalogApi.product).mockResolvedValue(detail({ media: [{ url: 'https://cdn.test/a.webp', alt: 'Front' }, { url: 'https://cdn.test/b.webp', alt: 'Box' }] }));
    open();
    const main = await screen.findByAltText('Front');
    expect(main).toHaveAttribute('src', 'https://cdn.test/a.webp');
    await userEvent.click(screen.getByRole('button', { name: 'Show image 2' }));
    expect(screen.getByAltText('Box')).toBeInTheDocument();
  });

  it('adds structured data for search engines, with "<" escaped, and removes it on leaving', async () => {
    vi.mocked(catalogApi.product).mockResolvedValue(detail({ name: 'A </script><b>x' }));
    const { unmount } = open();
    await screen.findByRole('heading', { level: 1 });
    const ld = document.head.querySelector('script[type="application/ld+json"]')!;
    expect(ld.textContent).not.toContain('</script>');
    expect(JSON.parse(ld.textContent!)).toMatchObject({ '@type': 'Product', offers: { priceCurrency: 'INR', price: '2850.00', availability: 'https://schema.org/InStock' } });
    unmount();
    expect(document.head.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it('shows a friendly "not found" for an unknown product, and an error with retry otherwise', async () => {
    const notFound = new AxiosError('nf', '404', undefined, undefined, { status: 404, data: {}, statusText: '', headers: {}, config: {} as never });
    vi.mocked(catalogApi.product).mockRejectedValueOnce(notFound);
    const { unmount } = open();
    expect(await screen.findByText('Fragrance not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all fragrances' })).toHaveAttribute('href', '/shop');
    unmount();

    vi.mocked(catalogApi.product).mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(detail());
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }, { timeout: 4000 }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Saffron Dusk' })).toBeInTheDocument());
    expect(within(document.body).queryByText('Fragrance not found')).toBeNull();
  });
});
