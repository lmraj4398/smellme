import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { loginsApi, type LoginRow } from '@/api/logins.api';
import { renderPage, signIn } from '@/test/render-page';
import LoginsPage from './LoginsPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/logins.api', () => ({ loginsApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), resetPassword: vi.fn() } }));

const mk = (over: Partial<LoginRow>): LoginRow => ({
  id: 'x', name: 'X', email: 'x@x.in', screens: null, is_active: true, last_login_at: null, created_at: '2026-10-01T00:00:00Z', ...over,
});
const SCREENS = ['orders', 'products', 'inventory', 'customers', 'coupons', 'reviews', 'content', 'marketing', 'logs', 'settings'];

beforeEach(() => {
  signIn({ id: 'me', name: 'Owner' });
  vi.mocked(loginsApi.list).mockResolvedValue({
    screens: SCREENS,
    items: [mk({ id: 'me', name: 'Owner', email: 'o@x.in' }), mk({ id: 'ed', name: 'Priya', email: 'priya@x.in', screens: ['content', 'products'] })],
  });
});

describe('LoginsPage', () => {
  it('shows each login with a plain-language summary of its access', async () => {
    renderPage(<LoginsPage />);
    expect(await screen.findByText('Priya')).toBeInTheDocument();
    expect(screen.getByText('Owner · all screens')).toBeInTheDocument();
    expect(screen.getByText('Website content, gift sets & FAQs')).toBeInTheDocument();
    expect(screen.getByText('(you)')).toBeInTheDocument();
  });

  it('does not let the owner edit their own access, or reset their own password here', async () => {
    renderPage(<LoginsPage />);
    await screen.findByText('Priya');
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).queryByRole('button', { name: /password/i })).toBeNull();
    await userEvent.click(within(rows[0]).getByRole('button', { name: /access/i }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByText(/can’t change your own access/i)).toBeInTheDocument();
    expect(within(dlg).queryByRole('checkbox')).toBeNull();
  });

  it('saves a restricted screen list for another login', async () => {
    vi.mocked(loginsApi.update).mockResolvedValue(mk({}));
    renderPage(<LoginsPage />);
    await screen.findByText('Priya');
    await userEvent.click(within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: /access/i }));
    const dlg = screen.getByRole('dialog');
    await userEvent.click(within(dlg).getByLabelText('Inventory'));
    await userEvent.click(within(dlg).getByRole('button', { name: 'Save' }));
    expect(loginsApi.update).toHaveBeenCalledWith('ed', { name: 'Priya', screens: ['content', 'products', 'inventory'], is_active: true });
  });

  it('ticking "Everything" sends screens: null, and disables the individual boxes', async () => {
    vi.mocked(loginsApi.create).mockResolvedValue(mk({}));
    renderPage(<LoginsPage />);
    await screen.findByText('Priya');
    await userEvent.click(screen.getByRole('button', { name: /add login/i }));
    const dlg = screen.getByRole('dialog');
    await userEvent.type(within(dlg).getByLabelText('Name'), 'Second Owner');
    await userEvent.type(within(dlg).getByLabelText('Email'), 'b@x.in');
    await userEvent.type(within(dlg).getByLabelText(/starting password/i), 'correct-horse-9');
    await userEvent.click(within(dlg).getByLabelText(/everything \(owner\)/i));
    expect(within(dlg).getByLabelText('Inventory')).toBeDisabled();
    await userEvent.click(within(dlg).getByRole('button', { name: /create login/i }));
    expect(loginsApi.create).toHaveBeenCalledWith({ name: 'Second Owner', email: 'b@x.in', password: 'correct-horse-9', screens: null });
  });

  it('warns that changes sign the person out', async () => {
    renderPage(<LoginsPage />);
    await screen.findByText('Priya');
    await userEvent.click(within(screen.getAllByRole('listitem')[1]).getByRole('button', { name: /access/i }));
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).queryByText(/signed out/i)).toBeNull();
    await userEvent.click(within(dlg).getByLabelText('Inventory'));
    expect(within(dlg).getByText(/signed out/i)).toBeInTheDocument();
  });
});
