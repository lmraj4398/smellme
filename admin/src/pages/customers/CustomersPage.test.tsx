import { screen } from '@testing-library/react';
import { commerceApi, type CustomerRow } from '@/api/commerce.api';
import { renderPage, signIn } from '@/test/render-page';
import CustomersPage from './CustomersPage';

vi.mock('@/api/commerce.api', async (orig) => ({ ...(await orig<typeof import('@/api/commerce.api')>()), commerceApi: { customers: vi.fn() } }));

const row = (over: Partial<CustomerRow> = {}): CustomerRow => ({
  id: 'c1', name: 'Anaya Rao', phone: '+919876543210', email: '', birthday: null, created_at: '2026-09-01T10:00:00Z',
  last_login_at: '2026-10-20T10:00:00Z', orders_count: 2, total_spent_paise: 640000, ...over,
});
const serve = (items: CustomerRow[]) => vi.mocked(commerceApi.customers).mockResolvedValue({ total: items.length, page: 1, limit: 30, items });

beforeEach(() => signIn());

describe('CustomersPage', () => {
  it('shows each customer with their orders and what they have paid', async () => {
    serve([row()]);
    renderPage(<CustomersPage />);
    expect(await screen.findByText('Anaya Rao')).toBeInTheDocument();
    expect(screen.getByText(/2 orders · paid ₹6,400/)).toBeInTheDocument();
  });

  it('shows a birthday as day and month only, so the owner knows when to send the sample', async () => {
    serve([row({ birthday: '1994-08-21' })]);
    renderPage(<CustomersPage />);
    expect(await screen.findByText('Birthday 21 Aug')).toBeInTheDocument();
    expect(screen.queryByText(/1994/)).toBeNull();
  });

  it('shows nothing about a birthday when there is none', async () => {
    serve([row()]);
    renderPage(<CustomersPage />);
    await screen.findByText('Anaya Rao');
    expect(screen.queryByText(/Birthday/)).toBeNull();
  });

  it('has an empty state', async () => {
    serve([]);
    renderPage(<CustomersPage />);
    expect(await screen.findByText('No customers found.')).toBeInTheDocument();
  });
});
