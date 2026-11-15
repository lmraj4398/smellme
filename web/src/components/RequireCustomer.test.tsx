import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import * as client from '@/api/client';
import { useCustomerStore } from '@/store/customer.store';
import { RequireCustomer, SessionBootstrap } from './RequireCustomer';

vi.mock('@/api/client', async (orig) => ({ ...(await orig<typeof import('@/api/client')>()), refreshCustomerSession: vi.fn() }));

const me = { id: 'c1', name: 'Anaya', phone: '+919876543210', email: '' };
function Where() { const l = useLocation(); return <div data-testid="where">{l.pathname + l.search}</div>; }

const app = (route: string) => render(
  <MemoryRouter initialEntries={[route]}>
    <SessionBootstrap />
    <Where />
    <Routes>
      <Route element={<RequireCustomer />}><Route path="/checkout" element={<div>checkout page</div>} /><Route path="/order/:no" element={<div>order page</div>} /></Route>
      <Route path="/login" element={<div>login page</div>} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => { useCustomerStore.setState({ customer: null, token: null, status: 'unknown' }); });

describe('RequireCustomer + SessionBootstrap', () => {
  it('waits (shows a spinner, not the page and not a redirect) while it is still finding out if they are signed in', () => {
    vi.mocked(client.refreshCustomerSession).mockReturnValue(new Promise(() => undefined));
    app('/checkout');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('checkout page')).toBeNull();
    expect(screen.queryByText('login page')).toBeNull();
  });

  it('restores a returning shopper from the refresh cookie and shows the page they asked for', async () => {
    vi.mocked(client.refreshCustomerSession).mockImplementation(async () => {
      useCustomerStore.getState().setSession(me, 'tok');
      return { token: 'tok', customer: me };
    });
    app('/checkout');
    expect(await screen.findByText('checkout page')).toBeInTheDocument();
  });

  it('sends a visitor with no session to sign in, remembering where they were going', async () => {
    vi.mocked(client.refreshCustomerSession).mockRejectedValue(new Error('401'));
    app('/order/SM-001001');
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/login?next=%2Forder%2FSM-001001');
  });

  it('does not ask the server again when the status is already known', () => {
    vi.mocked(client.refreshCustomerSession).mockClear();
    useCustomerStore.setState({ customer: me, token: 't', status: 'authed' });
    app('/checkout');
    expect(screen.getByText('checkout page')).toBeInTheDocument();
    expect(client.refreshCustomerSession).not.toHaveBeenCalled();
  });

  it('signing out in the middle of the session sends them to sign in', async () => {
    useCustomerStore.setState({ customer: me, token: 't', status: 'authed' });
    app('/checkout');
    useCustomerStore.getState().clear();
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
  });
});
