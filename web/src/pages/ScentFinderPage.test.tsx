import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { catalogApi } from '@/api/catalog';
import { useBag } from '@/store/cart.store';
import { card, detail, renderAt, V2 } from '@/test/render';
import ScentFinderPage from './ScentFinderPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/catalog', async (orig) => ({ ...(await orig<typeof import('@/api/catalog')>()), catalogApi: { products: vi.fn(), product: vi.fn() } }));

beforeEach(() => {
  localStorage.clear();
  useBag.setState({ lines: [] });
  vi.mocked(catalogApi.products).mockResolvedValue({ total: 1, page: 1, limit: 3, items: [card({ id: 'a', slug: 'saffron-dusk', name: 'Saffron Dusk' })] });
  vi.mocked(catalogApi.product).mockResolvedValue(detail());
});

const open = () => renderAt(<ScentFinderPage />, { path: '/scent-finder', route: '/scent-finder' });
const answerAll = async () => {
  for (const label of ['For me', 'A spice market at dusk', 'Every day', 'Noticeable']) {
    await userEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));
  }
  await userEvent.click(screen.getByRole('radio', { name: /Samples first/ }));
  await userEvent.click(screen.getByRole('button', { name: 'See my matches' }));
};

describe('ScentFinderPage', () => {
  it('starts on question 1 and cannot advance until an answer is picked', async () => {
    open();
    expect(screen.getByText(/Question 1 of 5/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next question' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: /For me/ }));
    expect(screen.getByRole('radio', { name: /For me/ })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));
    expect(screen.getByText(/Question 2 of 5/)).toBeInTheDocument();
  });

  it('keeps earlier answers when going back', async () => {
    open();
    await userEvent.click(screen.getByRole('radio', { name: /For me/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next question' }));
    await userEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(screen.getByRole('radio', { name: /For me/ })).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the profile and matched products after the last question', async () => {
    open();
    await answerAll();
    expect(await screen.findByRole('heading', { level: 1, name: /amber & spice/ })).toBeInTheDocument();
    expect(await screen.findByText('Saffron Dusk')).toBeInTheDocument();
    expect(vi.mocked(catalogApi.products).mock.calls[0][0]).toMatchObject({ family: ['amber'], sample: true });
  });

  it('adds each match’s 2 ml sample to the bag', async () => {
    open();
    await answerAll();
    await userEvent.click(await screen.findByRole('button', { name: 'Add sample trio' }));
    await waitFor(() => expect(useBag.getState().lines.map((l) => l.variantId)).toEqual([V2]));
    expect(toast.success).toHaveBeenCalled();
  });

  it('lets the shopper retake the quiz', async () => {
    open();
    await answerAll();
    await userEvent.click(await screen.findByRole('button', { name: 'Retake the quiz' }));
    expect(screen.getByText(/Question 1 of 5/)).toBeInTheDocument();
  });
});
