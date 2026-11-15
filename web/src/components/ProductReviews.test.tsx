import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { reviewsApi, type PublicReview, type ReviewsPage } from '@/api/reviews';
import { useCustomerStore } from '@/store/customer.store';
import { renderAt } from '@/test/render';
import { ProductReviews, RatingLink } from './ProductReviews';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/reviews', () => ({ reviewsApi: { list: vi.fn(), mine: vi.fn(), save: vi.fn(), remove: vi.fn() } }));

const rv = (over: Partial<PublicReview> = {}): PublicReview => ({
  id: 'r1', rating: 5, title: 'Beautiful', body: 'Compliments all day.', created_at: '2026-10-01T10:00:00Z', author: 'Anaya R.', verified: true, ...over,
});
const page = (items: PublicReview[], over: Partial<ReviewsPage> = {}): ReviewsPage => ({
  summary: { count: items.length, average: items.length ? items.reduce((n, r) => n + r.rating, 0) / items.length : 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: items.length } },
  page: 1, limit: 10, items, ...over,
});
const me = { id: 'c1', name: 'Anaya Rao', phone: '+919876543210', email: '' };
const open = () => renderAt(<ProductReviews slug="saffron-dusk" productId="p1" />);

beforeEach(() => {
  useCustomerStore.setState({ customer: null, token: null, status: 'anon' });
  vi.mocked(reviewsApi.list).mockResolvedValue(page([rv()]));
  vi.mocked(reviewsApi.mine).mockResolvedValue({ can_review: false, review: null });
  vi.mocked(reviewsApi.save).mockResolvedValue({ id: 'r1', rating: 5, title: '', body: '', status: 'published' });
  vi.mocked(reviewsApi.remove).mockResolvedValue({ ok: true });
});

describe('ProductReviews', () => {
  it('shows the average, the number of buyers, the breakdown and each review as plain text', async () => {
    vi.mocked(reviewsApi.list).mockResolvedValue(page([rv(), rv({ id: 'r2', rating: 4, title: '<b>hi</b>', body: '<script>alert(1)</script>', author: 'Karan' })]));
    open();
    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Based on 2 verified buyers')).toBeInTheDocument();
    expect(screen.getByText('Beautiful')).toBeInTheDocument();
    expect(screen.getByText('<b>hi</b>')).toBeInTheDocument();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(screen.getAllByText(/Verified buyer/)).toHaveLength(2);
  });

  it('renders nothing when there are no reviews and the visitor cannot write one', async () => {
    vi.mocked(reviewsApi.list).mockResolvedValue(page([]));
    const { container } = open();
    await waitFor(() => expect(reviewsApi.list).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the reviews cannot be loaded', async () => {
    vi.mocked(reviewsApi.list).mockRejectedValue(new Error('down'));
    const { container } = open();
    await waitFor(() => expect(reviewsApi.list).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('does not offer "Write a review" to signed-out visitors or to people who have not received the product', async () => {
    open();
    await screen.findByText('Beautiful');
    expect(screen.queryByRole('button', { name: /review/i })).toBeNull();
    expect(reviewsApi.mine).not.toHaveBeenCalled();
  });

  describe('as a customer who received the product', () => {
    beforeEach(() => {
      useCustomerStore.setState({ customer: me, token: 't', status: 'authed' });
      vi.mocked(reviewsApi.mine).mockResolvedValue({ can_review: true, review: null });
    });

    it('needs a star rating before posting', async () => {
      open();
      await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
      await userEvent.click(screen.getByRole('button', { name: 'Post review' }));
      expect(screen.getByRole('alert')).toHaveTextContent(/Choose a rating/);
      expect(reviewsApi.save).not.toHaveBeenCalled();
    });

    it('posts a review and closes the form', async () => {
      open();
      await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
      await userEvent.click(screen.getByRole('radio', { name: '4 stars' }));
      await userEvent.type(screen.getByLabelText(/Headline/), '  Lovely ');
      await userEvent.type(screen.getByLabelText(/Your review/), 'Lasts all day');
      await userEvent.click(screen.getByRole('button', { name: 'Post review' }));
      await waitFor(() => expect(reviewsApi.save).toHaveBeenCalledWith('p1', { rating: 4, title: 'Lovely', body: 'Lasts all day' }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Thank you for your review'));
      expect(screen.queryByRole('button', { name: 'Post review' })).toBeNull();
    });

    it('shows the server’s reason when posting fails', async () => {
      vi.mocked(reviewsApi.save).mockRejectedValue(new Error('Only customers whose order has been delivered can review a fragrance'));
      open();
      await userEvent.click(await screen.findByRole('button', { name: 'Write a review' }));
      await userEvent.click(screen.getByRole('radio', { name: '5 stars' }));
      await userEvent.click(screen.getByRole('button', { name: 'Post review' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/order has been delivered/);
    });

    it('lets them edit or delete the review they already wrote, prefilled', async () => {
      vi.mocked(reviewsApi.mine).mockResolvedValue({ can_review: true, review: { id: 'r1', rating: 3, title: 'Okay', body: 'Fine', status: 'published' } });
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      open();
      await userEvent.click(await screen.findByRole('button', { name: 'Edit your review' }));
      expect(screen.getByLabelText(/Headline/)).toHaveValue('Okay');
      expect(screen.getByRole('radio', { name: '3 stars' })).toHaveAttribute('aria-checked', 'true');
      await userEvent.click(screen.getByRole('button', { name: 'Delete review' }));
      await waitFor(() => expect(reviewsApi.remove).toHaveBeenCalledWith('p1'));
    });

    it('can write the first review even when there are none yet', async () => {
      vi.mocked(reviewsApi.list).mockResolvedValue(page([]));
      open();
      expect(await screen.findByRole('button', { name: 'Write a review' })).toBeInTheDocument();
    });

    it('tells an author when the owner has hidden their review', async () => {
      vi.mocked(reviewsApi.mine).mockResolvedValue({ can_review: true, review: { id: 'r1', rating: 1, title: '', body: '', status: 'hidden' } });
      open();
      expect(await screen.findByText(/currently hidden/)).toBeInTheDocument();
    });
  });

  it('loads more reviews on demand', async () => {
    vi.mocked(reviewsApi.list)
      .mockResolvedValueOnce({ ...page([rv({ id: 'a', title: 'First' })]), summary: { count: 2, average: 5, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 } }, limit: 1 })
      .mockResolvedValueOnce({ ...page([rv({ id: 'b', title: 'Second' })]), page: 2, summary: { count: 2, average: 5, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2 } }, limit: 1 });
    open();
    await screen.findByText('First');
    await userEvent.click(screen.getByRole('button', { name: 'Show more reviews' }));
    expect(await screen.findByText('Second')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more reviews' })).toBeNull();
  });
});

describe('RatingLink', () => {
  it('links to the reviews with the average and count', async () => {
    vi.mocked(reviewsApi.list).mockResolvedValue(page([rv(), rv({ id: 'r2', rating: 4 })]));
    renderAt(<RatingLink slug="saffron-dusk" />);
    const link = await screen.findByRole('link');
    expect(link).toHaveAttribute('href', '#reviews');
    expect(within(link).getByText('4.5 · 2 reviews')).toBeInTheDocument();
  });

  it('shows nothing until there is a review', async () => {
    vi.mocked(reviewsApi.list).mockResolvedValue(page([]));
    const { container } = renderAt(<RatingLink slug="saffron-dusk" />);
    await waitFor(() => expect(reviewsApi.list).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
