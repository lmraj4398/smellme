import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { commerceApi } from '@/api/commerce';
import { useCustomerStore } from '@/store/customer.store';
import { orderView, savedAddress, settings } from '@/test/commerce';
import AccountPage from './AccountPage';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/commerce', async (orig) => ({
  ...(await orig<typeof import('@/api/commerce')>()),
  commerceApi: { orders: vi.fn(), addresses: vi.fn(), deleteAddress: vi.fn(), saveAddress: vi.fn(), settings: vi.fn(), updateMe: vi.fn(), logout: vi.fn() },
}));

const me = { id: 'c1', name: 'Anaya Rao', phone: '+919876543210', email: '' };
function Where() { return <div data-testid="where">{useLocation().pathname}</div>; }
let client: QueryClient;
const open = () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/account?tab=orders']}><Where /><Routes><Route path="/account" element={<AccountPage />} /><Route path="*" element={<div>elsewhere</div>} /></Routes></MemoryRouter></QueryClientProvider>);
};

beforeEach(() => {
  useCustomerStore.setState({ customer: me, token: 't', status: 'authed' });
  vi.mocked(commerceApi.orders).mockResolvedValue({ total: 2, items: [
    { order_no: 'SM-001002', status: 'PENDING_PAYMENT', created_at: '2026-10-22T10:00:00Z', total_paise: 154900, items: [{ name: 'Rose Velours', label: '12 ml', qty: 1 }] },
    { order_no: 'SM-001001', status: 'DELIVERED', created_at: '2026-10-01T10:00:00Z', total_paise: 285000, items: [{ name: 'Saffron Dusk', label: '50 ml', qty: 1 }] },
  ] });
  vi.mocked(commerceApi.addresses).mockResolvedValue([savedAddress()]);
  vi.mocked(commerceApi.settings).mockResolvedValue(settings);
  vi.mocked(commerceApi.logout).mockResolvedValue(undefined);
  vi.mocked(commerceApi.updateMe).mockImplementation(async (b) => ({ ...me, ...b }));
  vi.mocked(commerceApi.deleteAddress).mockResolvedValue(undefined);
  void orderView;
});

describe('AccountPage', () => {
  it('greets by first name and lists orders with a clear next step for unpaid ones', async () => {
    open();
    expect(screen.getByText('Hello, Anaya')).toBeInTheDocument();
    const unpaid = (await screen.findByText('SM-001002', { exact: false })).closest('a')!;
    expect(within(unpaid).getByText('Waiting for your payment')).toBeInTheDocument();
    expect(within(unpaid).getByText('Pay now')).toBeInTheDocument();
    expect(unpaid).toHaveAttribute('href', '/order/SM-001002');
    const done = screen.getByText('SM-001001', { exact: false }).closest('a')!;
    expect(within(done).getByText('View')).toBeInTheDocument();
  });

  it('shows an empty state with a way to start shopping', async () => {
    vi.mocked(commerceApi.orders).mockResolvedValue({ total: 0, items: [] });
    open();
    expect(await screen.findByText(/No orders yet/)).toBeInTheDocument();
  });

  it('signing out ends the session, WIPES cached data, and leaves the account', async () => {
    open();
    await screen.findByText('SM-001002', { exact: false });
    expect(client.getQueryCache().getAll().length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/'));
    expect(screen.getByText('elsewhere')).toBeInTheDocument();
    expect(commerceApi.logout).toHaveBeenCalled();
    expect(useCustomerStore.getState()).toMatchObject({ status: 'anon', token: null, customer: null });
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(0));
  });

  it('still signs them out locally if the server cannot be reached', async () => {
    vi.mocked(commerceApi.logout).mockRejectedValue(new Error('offline'));
    open();
    await screen.findByText('SM-001002', { exact: false });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(useCustomerStore.getState().status).toBe('anon'));
  });

  it('removes a saved address only after confirming', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Addresses' }));
    const remove = await screen.findByRole('button', { name: 'Remove' });
    await userEvent.click(remove);
    expect(commerceApi.deleteAddress).not.toHaveBeenCalled();
    await userEvent.click(remove);
    await waitFor(() => expect(commerceApi.deleteAddress).toHaveBeenCalledWith('a1'));
    confirm.mockRestore();
  });

  it('validates a new address before saving it', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Addresses' }));
    await userEvent.click(await screen.findByRole('button', { name: /add a new address/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Choose a state')).toBeInTheDocument();
    expect(commerceApi.saveAddress).not.toHaveBeenCalled();
  });

  it('the phone number is read-only (it is how they sign in); name and email can be saved', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(await screen.findByLabelText(/Mobile \(WhatsApp\)/)).toHaveAttribute('readonly');
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Anaya R');
    await userEvent.type(screen.getByLabelText(/Email/), 'anaya@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commerceApi.updateMe).toHaveBeenCalledWith({ name: 'Anaya R', email: 'anaya@example.com', birthday: '' }));
    expect(useCustomerStore.getState().customer?.name).toBe('Anaya R');
  });

  it('rejects an invalid email without calling the API', async () => {
    open();
    await userEvent.click(screen.getByRole('button', { name: 'Details' }));
    await userEvent.type(await screen.findByLabelText(/Email/), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/);
    expect(commerceApi.updateMe).not.toHaveBeenCalled();
  });
});
