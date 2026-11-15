import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { reviewsApi, type ReviewRow } from '@/api/reviews.api';
import { renderPage, signIn } from '@/test/render-page';
import ReviewsPage from './ReviewsPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/reviews.api', () => ({ reviewsApi: { list: vi.fn(), setStatus: vi.fn() } }));

const row = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  id: 'r1', rating: 2, title: 'Too sweet', body: 'Not for me.', status: 'published', created_at: '2026-10-01T10:00:00Z',
  customer_name: 'Anaya Rao', customer_phone: '+919876543210', product_name: 'Saffron Dusk', product_slug: 'saffron-dusk', ...over,
});
const serve = (items: ReviewRow[], hidden = 0) => vi.mocked(reviewsApi.list).mockResolvedValue({ total: items.length, page: 1, limit: 20, hidden, items });

beforeEach(() => {
  signIn();
  serve([row()]);
  vi.mocked(reviewsApi.setStatus).mockResolvedValue({ id: 'r1', status: 'hidden' });
});

describe('Admin ReviewsPage', () => {
  it('lists each review with the product, who wrote it and when', async () => {
    renderPage(<ReviewsPage />);
    expect(await screen.findByText('Too sweet')).toBeInTheDocument();
    expect(screen.getByText('Saffron Dusk')).toBeInTheDocument();
    expect(screen.getByText(/Anaya Rao · \+919876543210/)).toBeInTheDocument();
    expect(screen.getByLabelText('2 out of 5')).toBeInTheDocument();
  });

  it('shows review text as plain text, never as HTML', async () => {
    serve([row({ title: '<img src=x onerror=alert(1)>', body: '<script>alert(1)</script>' })]);
    const { container } = renderPage(<ReviewsPage />);
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('script, img')).toBeNull();
  });

  it('hides a review', async () => {
    renderPage(<ReviewsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /Hide/ }));
    await waitFor(() => expect(reviewsApi.setStatus).toHaveBeenCalledWith('r1', 'hidden'));
  });

  it('shows a hidden review with a badge, and can bring it back', async () => {
    serve([row({ status: 'hidden' })], 1);
    renderPage(<ReviewsPage />);
    const item = (await screen.findByText('Too sweet')).closest('li')!;
    expect(within(item).getByText('Hidden')).toBeInTheDocument();
    await userEvent.click(within(item).getByRole('button', { name: /Show again/ }));
    await waitFor(() => expect(reviewsApi.setStatus).toHaveBeenCalledWith('r1', 'published'));
  });

  it('filters by status and shows how many are hidden', async () => {
    serve([row()], 3);
    renderPage(<ReviewsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Hidden (3)' }));
    await waitFor(() => expect(reviewsApi.list).toHaveBeenLastCalledWith({ status: 'hidden', page: 1 }));
  });

  it('has an empty state', async () => {
    serve([]);
    renderPage(<ReviewsPage />);
    expect(await screen.findByText('No reviews yet.')).toBeInTheDocument();
  });
});
