import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as content from '@/api/content';
import { renderAt } from '@/test/render';
import GiftingPage from './GiftingPage';

vi.mock('@/api/content', async (orig) => ({ ...(await orig<typeof import('@/api/content')>()), useContent: vi.fn() }));

const gifting = (sets: { name: string; price_text: string }[]) => ({
  hero: { eyebrow: 'Gifting', heading: 'Gifts that *linger*.', body: '' },
  sets: { eyebrow: 'Gift sets', heading: 'Ready to give', items: sets.map((s) => ({ tag: '', description: '', product_slug: '', image: '', ...s })) },
  personalise: { eyebrow: '', heading: 'Engraving, a note & wrapping', wrap_price_text: '' },
  occasions: { heading: 'Gift by occasion', items: [] },
  corporate: { eyebrow: '', heading: 'Gifting for 25 or more?', cta_label: 'Request a quote' },
});
const serve = (sets: { name: string; price_text: string }[]) =>
  vi.mocked(content.useContent).mockReturnValue({ data: gifting(sets), isLoading: false, isError: false, refetch: vi.fn() } as never);
const open = () => renderAt(<GiftingPage />, { path: '/gifting', route: '/gifting' });
const SETS = [{ name: 'Attar Trio', price_text: '₹1,499' }, { name: 'Duo', price_text: '₹2,500' }, { name: 'Grand Box', price_text: '₹4,200' }, { name: 'Discovery Set', price_text: '' }];

describe('GiftingPage', () => {
  it('links the "who is it for" chips to the shop, filtered by recipient', () => {
    serve(SETS);
    open();
    const who = screen.getByRole('group', { name: 'Who is it for' });
    expect(within(who).getByRole('link', { name: 'For her' })).toHaveAttribute('href', '/shop?gender=women');
    expect(within(who).getByRole('link', { name: 'For him' })).toHaveAttribute('href', '/shop?gender=men');
    expect(within(who).getByRole('link', { name: 'For anyone' })).toHaveAttribute('href', '/shop?gender=unisex');
  });

  it('shows every set under "All" and narrows them by budget', async () => {
    serve(SETS);
    open();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(4);
    await userEvent.click(screen.getByRole('button', { name: 'Under ₹1,500' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Attar Trio']);
    await userEvent.click(screen.getByRole('button', { name: '₹1,500 – ₹3,000' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Duo']);
    await userEvent.click(screen.getByRole('button', { name: '₹3,000+' }));
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Grand Box']);
  });

  it('says so, with a way back, when nothing fits the budget', async () => {
    serve([{ name: 'Attar Trio', price_text: '₹1,499' }]);
    open();
    await userEvent.click(screen.getByRole('button', { name: '₹3,000+' }));
    expect(screen.getByText(/No gift sets in this budget/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }));
    expect(screen.getByRole('heading', { level: 3, name: 'Attar Trio' })).toBeInTheDocument();
  });

  it('hides the budget chips when no set has a readable price', () => {
    serve([{ name: 'Discovery Set', price_text: '' }]);
    open();
    expect(screen.queryByRole('group', { name: 'Budget' })).toBeNull();
    expect(screen.getByRole('heading', { level: 3, name: 'Discovery Set' })).toBeInTheDocument();
  });

  it('previews the engraving on the bottle as the shopper types, capped at 14 characters', async () => {
    serve(SETS);
    open();
    const input = screen.getByLabelText('Preview your engraving');
    await userEvent.clear(input);
    await userEvent.type(input, 'For Priya Sharma and family');
    expect(input).toHaveValue('For Priya Shar');
    expect(screen.getByText('For Priya Shar')).toBeInTheDocument(); // the label on the bottle
  });
});
