import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { errorLogsApi, type ErrorEntry, type ErrorGroup } from '@/api/error-logs.api';
import { renderPage, signIn } from '@/test/render-page';
import ErrorLogsPage from './ErrorLogsPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/error-logs.api', () => ({ errorLogsApi: { groups: vi.fn(), entries: vi.fn(), clear: vi.fn() } }));

const group = (over: Partial<ErrorGroup> = {}): ErrorGroup => ({ group_key: 'Orders.create', group_label: 'OrdersController.create', count: 3, last_at: '2026-10-02T10:00:00Z', has_error: true, status_code: 500, ...over });
const entry = (over: Partial<ErrorEntry> = {}): ErrorEntry => ({
  id: 'e1', severity: 'error', status_code: 500, method: 'POST', url: '/api/customer/orders', message: 'Out of stock', created_at: '2026-10-02T10:00:00Z',
  request_query: null, request_body: '{"qty":1}', user_id: 'c1', user_type: 'customer', screen: '/checkout', ...over,
});

beforeEach(() => {
  signIn();
  vi.mocked(errorLogsApi.groups).mockResolvedValue({ total: 1, page: 1, limit: 30, items: [group()] });
  vi.mocked(errorLogsApi.entries).mockResolvedValue({ total: 1, page: 1, limit: 20, items: [entry()] });
  vi.mocked(errorLogsApi.clear).mockResolvedValue({ deleted: 3 });
});

describe('ErrorLogsPage', () => {
  it('lists failures grouped, with how many times and the status', async () => {
    renderPage(<ErrorLogsPage />);
    expect(await screen.findByText('OrdersController.create')).toBeInTheDocument();
    expect(screen.getByLabelText('3 times')).toHaveTextContent('3×');
    expect(screen.getByText('Error 500')).toBeInTheDocument();
  });

  it('has an empty state', async () => {
    vi.mocked(errorLogsApi.groups).mockResolvedValue({ total: 0, page: 1, limit: 30, items: [] });
    renderPage(<ErrorLogsPage />);
    expect(await screen.findByText(/Nothing has gone wrong/)).toBeInTheDocument();
  });

  it('shows the entries of a group when opened, as plain text', async () => {
    vi.mocked(errorLogsApi.entries).mockResolvedValue({ total: 1, page: 1, limit: 20, items: [entry({ message: '<img src=x onerror=alert(1)>' })] });
    const { container } = renderPage(<ErrorLogsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /OrdersController\.create/ }));
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(errorLogsApi.entries).toHaveBeenCalledWith('Orders.create', 1);
    expect(screen.getByText(/customer c1 · from \/checkout/)).toBeInTheDocument();
    expect(screen.getByText('{"qty":1}')).toBeInTheDocument();
  });

  it('filters by severity', async () => {
    renderPage(<ErrorLogsPage />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Warnings' }));
    await waitFor(() => expect(errorLogsApi.groups).toHaveBeenLastCalledWith({ severity: 'warning', page: 1 }));
  });

  it('clears a group after confirming, and not if the owner says no', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderPage(<ErrorLogsPage />);
    await userEvent.click(await screen.findByRole('button', { name: /OrdersController\.create/ }));
    const open = (await screen.findByText('Out of stock')).closest('div')!.parentElement!;
    await userEvent.click(within(open).getByRole('button', { name: /Clear this group/ }));
    expect(errorLogsApi.clear).not.toHaveBeenCalled();
    await userEvent.click(within(open).getByRole('button', { name: /Clear this group/ }));
    await waitFor(() => expect(errorLogsApi.clear).toHaveBeenCalledWith('Orders.create'));
    expect(confirmSpy).toHaveBeenCalledTimes(2);
  });
});
