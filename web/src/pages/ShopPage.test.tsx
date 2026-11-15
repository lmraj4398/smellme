import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApi, type FilterOptions } from '@/api/catalog';
import { card, currentUrl, renderAt } from '@/test/render';
import ShopPage from './ShopPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/catalog', async (orig) => ({ ...(await orig<typeof import('@/api/catalog')>()), catalogApi: { products: vi.fn(), filters: vi.fn() } }));

const options: FilterOptions = {
  families: [{ slug: 'amber', name: 'Amber', tint: '#F3E6D6', count: 3 }, { slug: 'oud', name: 'Oud', tint: '#ECE2D6', count: 1 }],
  brands: [{ slug: 'smellme-originals', name: 'SmellMe Originals', is_original: true, count: 3 }],
  genders: [{ value: 'men', count: 2 }, { value: 'unisex', count: 2 }],
  concentrations: [{ value: 'edp', label: 'Eau de Parfum', count: 3 }],
  price_paise: { min: 195000, max: 690000 },
};
const page = (n: number, total: number, names: string[], limit = 12) => ({ total, page: n, limit, items: names.map((name, i) => card({ id: `${n}-${i}`, slug: name.toLowerCase(), name })) });
const lastQuery = () => vi.mocked(catalogApi.products).mock.calls.at(-1)![0];

beforeEach(() => {
  vi.mocked(catalogApi.filters).mockResolvedValue(options);
  vi.mocked(catalogApi.products).mockResolvedValue(page(1, 2, ['Alpha', 'Beta']));
});

const open = (route = '/shop') => renderAt(<ShopPage />, { path: '/shop', route });

describe('ShopPage', () => {
  it('loads the first page with default sorting and shows the count', async () => {
    open();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
    expect(lastQuery()).toMatchObject({ sort: 'pop', page: 1, limit: 12 });
    expect(screen.getByText('2 results')).toBeInTheDocument();
  });

  it('reads filters from the URL, so a shared link opens the same view', async () => {
    open('/shop?family=amber,oud&gender=men&price=m&sort=low&q=saffron&sample=true');
    await screen.findByText('Alpha');
    expect(lastQuery()).toMatchObject({ family: ['amber', 'oud'], gender: ['men'], price_min: 200000, price_max: 400000, sort: 'low', q: 'saffron', sample: true });
    expect(screen.getByLabelText(/^Amber/)).toBeChecked();
    expect(screen.getByLabelText('Sort by')).toHaveValue('low');
  });

  it('ticking a family filter calls the API with it and writes it to the URL', async () => {
    open();
    await screen.findByText('Alpha');
    await userEvent.click(await screen.findByLabelText(/^Oud/));
    await waitFor(() => expect(lastQuery()).toMatchObject({ family: ['oud'], page: 1 }));
    expect(currentUrl()).toBe('/shop?family=oud');
    await userEvent.click(screen.getByLabelText(/^Amber/));
    await waitFor(() => expect(lastQuery().family).toEqual(['oud', 'amber']));
  });

  it('a price band is single-choice and can be clicked again to turn off', async () => {
    open();
    await screen.findByText('Alpha');
    await userEvent.click(await screen.findByLabelText('Under ₹2,000'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ price_max: 200000 }));
    await userEvent.click(screen.getByLabelText('₹2,000 – ₹4,000'));
    await waitFor(() => expect(lastQuery()).toMatchObject({ price_min: 200000, price_max: 400000 }));
    await userEvent.click(screen.getByLabelText('₹2,000 – ₹4,000'));
    await waitFor(() => expect(lastQuery().price_min).toBeUndefined());
    expect(currentUrl()).toBe('/shop');
  });

  it('changing the sort re-queries and updates the URL', async () => {
    open();
    await screen.findByText('Alpha');
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'high');
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'high' }));
    expect(currentUrl()).toBe('/shop?sort=high');
  });

  it('"Clear all" is disabled with no filters and resets everything otherwise', async () => {
    open('/shop?family=amber&sort=new');
    await screen.findByText('Alpha');
    const clear = screen.getByRole('button', { name: 'Clear all' });
    expect(clear).toBeEnabled();
    await userEvent.click(clear);
    await waitFor(() => expect(lastQuery()).toMatchObject({ sort: 'pop' }));
    expect(lastQuery().family).toEqual([]);
    expect(currentUrl()).toBe('/shop');
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeDisabled();
  });

  it('search is debounced into the URL after typing stops', async () => {
    open();
    await screen.findByText('Alpha');
    await userEvent.type(screen.getByLabelText('Search fragrances'), 'rose');
    await waitFor(() => expect(lastQuery()).toMatchObject({ q: 'rose' }), { timeout: 2000 });
    expect(currentUrl()).toBe('/shop?q=rose');
  });

  it('"Load more" appends the next page and the counter follows', async () => {
    vi.mocked(catalogApi.products).mockImplementation(async (q) => (q.page === 2 ? page(2, 3, ['Gamma'], 2) : page(1, 3, ['Alpha', 'Beta'], 2)));
    open();
    await screen.findByText('Alpha');
    expect(screen.getByText('You’ve seen 2 of 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument(); // earlier page kept
    expect(lastQuery()).toMatchObject({ page: 2 });
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('shows an empty state with a way out when nothing matches', async () => {
    vi.mocked(catalogApi.products).mockResolvedValue(page(1, 0, []));
    open('/shop?q=zzz');
    expect(await screen.findByText('No fragrances match these filters')).toBeInTheDocument();
    await userEvent.click(within(screen.getByText('No fragrances match these filters').parentElement!).getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(currentUrl()).toBe('/shop'));
  });

  it('shows an error with retry when the API fails', async () => {
    vi.mocked(catalogApi.products).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(page(1, 1, ['Alpha']));
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Alpha')).toBeInTheDocument();
  });

  it('survives hostile URL values (unknown sort/price, absurd length) without breaking', async () => {
    open(`/shop?sort=drop&price=free&family=,,&q=${'x'.repeat(300)}`);
    await screen.findByText('Alpha');
    expect(lastQuery()).toMatchObject({ sort: 'pop' });
    expect(lastQuery().q).toHaveLength(80);
  });
});
