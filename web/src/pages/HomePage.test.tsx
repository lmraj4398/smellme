import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { catalogApi } from '@/api/catalog';
import * as content from '@/api/content';
import type { HomeContent } from '@/api/content';
import { card, renderAt } from '@/test/render';
import HomePage from './HomePage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/catalog', async (orig) => ({ ...(await orig<typeof import('@/api/catalog')>()), catalogApi: { products: vi.fn(), families: vi.fn(), brands: vi.fn() } }));
vi.mock('@/api/content', async (orig) => ({ ...(await orig<typeof import('@/api/content')>()), useContent: vi.fn(), inboxApi: { contact: vi.fn(), subscribe: vi.fn() } }));

const home = (over: Partial<HomeContent> = {}): HomeContent => ({
  hero: { eyebrow: 'House · India', headline: 'Find the scent that *stays* with you.', body: 'Try any as a sample.', primary_label: 'Shop fragrances', secondary_label: 'Take the scent quiz', image: '' },
  trust: { items: [{ title: '100% authentic', sub: 'Sourced properly' }] },
  families: { eyebrow: 'Shop by scent family', heading: 'What do you love to smell?' },
  bestsellers: { eyebrow: 'Most loved', heading: 'Fragrances everyone asks about' },
  originals: { eyebrow: 'SmellMe Originals', heading: 'Our own line', body: 'Made for heat.', image_1: '', image_2: '', stats: [], cta_label: 'Explore the Originals' },
  discovery: { eyebrow: 'Try', heading: 'The Discovery Set', body: 'Pick 6.', price_text: '', cta_label: 'Build your set' },
  quiz: { eyebrow: 'Scent finder', heading: 'Not sure?', body: 'Five questions.', steps: [{ text: 'Tell us' }], cta_label: 'Start the quiz' },
  moments: { eyebrow: '', heading: 'A scent for every occasion', items: [{ label: 'Monsoon', sub: 'Earthy' }] },
  guides: { eyebrow: '', heading: 'Learn', items: [{ tag: 'Basics', title: 'EDP or EDT?', image: '' }] },
  newsletter: { kicker: 'The SmellMe letter', heading: 'New launches and a free sample.' },
  ...over,
});
const lastProductsQuery = () => vi.mocked(catalogApi.products).mock.calls.at(-1)![0];
const use = (c: HomeContent) => vi.mocked(content.useContent).mockReturnValue({ data: c, isLoading: false, isError: false, refetch: vi.fn() } as never);

beforeEach(() => {
  use(home());
  vi.mocked(catalogApi.products).mockResolvedValue({ total: 1, page: 1, limit: 4, items: [card()] });
  vi.mocked(catalogApi.families).mockResolvedValue([{ id: 'f1', name: 'Amber', slug: 'amber', tint: '#F3E6D6', ink: '#9A6A2E', notes_hint: 'Saffron, vanilla' }]);
  vi.mocked(catalogApi.brands).mockResolvedValue([{ id: 'b1', name: 'SmellMe Originals', slug: 'smellme-originals', is_original: true }]);
  vi.mocked(content.inboxApi.subscribe).mockResolvedValue({ ok: true });
});

describe('HomePage', () => {
  it('renders the hero from content, with the starred word emphasised', async () => {
    renderAt(<HomePage />);
    const h1 = await screen.findByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Find the scent that stays with you.');
    expect(within(h1).getByText('stays').tagName).toBe('EM');
    expect(screen.getByRole('link', { name: 'Shop fragrances' })).toHaveAttribute('href', '/shop');
  });

  it('hides optional blocks the owner left empty (no "[N]" or empty price)', async () => {
    renderAt(<HomePage />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('term')).toBeNull(); // originals stats
    expect(document.body.textContent).not.toMatch(/\[[A-Za-z]/);
    use(home({ hero: { ...home().hero, secondary_label: '', body: '' }, trust: { items: [] }, moments: { eyebrow: '', heading: 'x', items: [] } }));
  });

  it('hides a whole section when its list is empty', async () => {
    use(home({ trust: { items: [] }, moments: { eyebrow: '', heading: 'A scent for every occasion', items: [] }, guides: { eyebrow: '', heading: 'Learn', items: [] } }));
    renderAt(<HomePage />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByLabelText('Why SmellMe')).toBeNull();
    expect(screen.queryByText('A scent for every occasion')).toBeNull();
    expect(screen.queryByText('Learn')).toBeNull();
  });

  it('shows highlights only when entered', async () => {
    use(home({ originals: { ...home().originals, stats: [{ value: '6', label: 'signature scents' }, { value: '', label: 'ignored' }] } }));
    renderAt(<HomePage />);
    expect(await screen.findByText('signature scents')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).toBeNull();
  });

  it('links scent families to the filtered shop and the Originals button to the own-brand filter', async () => {
    renderAt(<HomePage />);
    expect(await screen.findByRole('link', { name: /Amber/ })).toHaveAttribute('href', '/shop?family=amber');
    await waitFor(() => expect(screen.getByRole('link', { name: 'Explore the Originals' })).toHaveAttribute('href', '/shop?brand=smellme-originals'));
  });

  it('product tabs query the API differently: popular, newest, under ₹2,500', async () => {
    renderAt(<HomePage />);
    await screen.findByText('Saffron Dusk');
    expect(lastProductsQuery()).toMatchObject({ sort: 'pop', limit: 4 });
    await userEvent.click(screen.getByRole('tab', { name: 'New arrivals' }));
    await waitFor(() => expect(lastProductsQuery()).toMatchObject({ sort: 'new' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Under ₹2,500' }));
    await waitFor(() => expect(lastProductsQuery()).toMatchObject({ price_max: 250000 }));
    expect(screen.getByRole('tab', { name: 'Under ₹2,500' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows a friendly line when a tab has no products', async () => {
    vi.mocked(catalogApi.products).mockResolvedValue({ total: 0, page: 1, limit: 4, items: [] });
    renderAt(<HomePage />);
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();
  });

  it('shows an error with retry when content cannot load', async () => {
    const refetch = vi.fn();
    vi.mocked(content.useContent).mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch } as never);
    renderAt(<HomePage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(refetch).toHaveBeenCalled();
  });
});

describe('Newsletter box', () => {
  it('subscribes a valid address and thanks them', async () => {
    renderAt(<HomePage />);
    await userEvent.type(await screen.findByLabelText('Email address'), ' priya@example.com ');
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    await waitFor(() => expect(content.inboxApi.subscribe).toHaveBeenCalledWith({ email: 'priya@example.com' }));
    expect(await screen.findByText(/you’re on the list/i)).toBeInTheDocument();
  });

  it('rejects an invalid address without calling the API', async () => {
    renderAt(<HomePage />);
    await userEvent.type(await screen.findByLabelText('Email address'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/);
    expect(content.inboxApi.subscribe).not.toHaveBeenCalled();
  });

  it('keeps the form and shows an error if the request fails', async () => {
    vi.mocked(content.inboxApi.subscribe).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    renderAt(<HomePage />);
    await userEvent.type(await screen.findByLabelText('Email address'), 'a@b.co');
    await userEvent.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeEnabled();
  });
});
