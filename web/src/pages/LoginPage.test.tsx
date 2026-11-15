import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { commerceApi } from '@/api/commerce';
import { currentUrl, renderAt } from '@/test/render';
import { useCustomerStore } from '@/store/customer.store';
import LoginPage from './LoginPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/commerce', () => ({ commerceApi: { sendOtp: vi.fn(), verifyOtp: vi.fn() } }));

const me = { id: 'c1', name: 'Anaya', phone: '+919876543210', email: '' };
const open = (route = '/login') => renderAt(<LoginPage />, { path: '/login', route });
const err429 = () => new AxiosError('429', '429', undefined, undefined, { status: 429, data: { message: 'Please wait', retry_after: 24 }, statusText: '', headers: {}, config: {} as never });
const phone = () => screen.getByLabelText('Mobile number');
const sendBtn = () => screen.getByRole('button', { name: 'Send code on WhatsApp' });

beforeEach(() => {
  useCustomerStore.setState({ customer: null, token: null, status: 'anon' });
  vi.mocked(commerceApi.sendOtp).mockResolvedValue({ ok: true, expires_in: 300, resend_after: 30 });
  vi.mocked(commerceApi.verifyOtp).mockResolvedValue({ token: 'tok', customer: me });
});

async function toCodeStep(n = '98765 43210') {
  await userEvent.type(phone(), n);
  await userEvent.click(sendBtn());
  return screen.findByLabelText('Code');
}

describe('LoginPage', () => {
  it('asks for a valid Indian mobile before sending anything', async () => {
    open();
    await userEvent.type(phone(), '12345');
    await userEvent.click(sendBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent(/valid 10-digit/);
    expect(commerceApi.sendOtp).not.toHaveBeenCalled();
  });

  it('sends the code to the normalised number and moves to the code step', async () => {
    open();
    await toCodeStep('098765 43210');
    expect(commerceApi.sendOtp).toHaveBeenCalledWith('+919876543210');
    expect(screen.getByText(/\+91 9876543210/)).toBeInTheDocument();
  });

  it('verifies automatically at 6 digits, signs in, and goes to the requested page', async () => {
    open('/login?next=%2Fcheckout');
    const code = await toCodeStep();
    await userEvent.type(code, '123456');
    await waitFor(() => expect(commerceApi.verifyOtp).toHaveBeenCalledWith('+919876543210', '123456', undefined));
    await waitFor(() => expect(useCustomerStore.getState()).toMatchObject({ status: 'authed', token: 'tok' }));
    await waitFor(() => expect(currentUrl()).toBe('/checkout'));
  });

  it('passes the name for new customers', async () => {
    open();
    const code = await toCodeStep();
    await userEvent.type(screen.getByLabelText(/your name/i), 'Anaya Rao');
    await userEvent.type(code, '123456');
    await waitFor(() => expect(commerceApi.verifyOtp).toHaveBeenCalledWith('+919876543210', '123456', 'Anaya Rao'));
  });

  it.each(['https://evil.com', '//evil.com', 'javascript:alert(1)', '/login'])('never redirects to an unsafe next=%s', async (next) => {
    open(`/login?next=${encodeURIComponent(next)}`);
    const code = await toCodeStep();
    await userEvent.type(code, '123456');
    await waitFor(() => expect(currentUrl()).toBe('/account'));
  });

  it('shows the error for a wrong code, clears the box, and lets them try again', async () => {
    vi.mocked(commerceApi.verifyOtp).mockRejectedValueOnce(new AxiosError('400', '400', undefined, undefined, { status: 400, data: { message: 'That code is incorrect or has expired' }, statusText: '', headers: {}, config: {} as never }));
    open();
    const code = await toCodeStep();
    await userEvent.type(code, '111111');
    expect(await screen.findByRole('alert')).toHaveTextContent('That code is incorrect or has expired');
    expect(code).toHaveValue('');
    expect(useCustomerStore.getState().status).toBe('anon');
    await userEvent.type(code, '123456');
    await waitFor(() => expect(useCustomerStore.getState().status).toBe('authed'));
  });

  it('only accepts digits in the code box', async () => {
    open();
    const code = await toCodeStep();
    await userEvent.type(code, '12ab34');
    expect(code).toHaveValue('1234');
  });

  it('tells the user how long to wait when they ask too often', async () => {
    vi.mocked(commerceApi.sendOtp).mockRejectedValue(err429());
    open();
    await userEvent.type(phone(), '9876543210');
    await userEvent.click(sendBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent(/24s/);
  });

  it('shows a friendly message when WhatsApp is down (503)', async () => {
    vi.mocked(commerceApi.sendOtp).mockRejectedValue(new AxiosError('503', '503', undefined, undefined, { status: 503, data: { message: 'We couldn’t send the code on WhatsApp right now. Please try again in a moment.' }, statusText: '', headers: {}, config: {} as never }));
    open();
    await userEvent.type(phone(), '9876543210');
    await userEvent.click(sendBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn’t send the code/);
    expect(screen.queryByLabelText('Code')).toBeNull(); // stays on the phone step
  });

  it('resend is locked for the cooldown, then works', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    open();
    await toCodeStep();
    const resend = screen.getByRole('button', { name: /resend code in 30s/i });
    expect(resend).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    const ready = await screen.findByRole('button', { name: 'Resend code' });
    expect(ready).toBeEnabled();
    await userEvent.click(ready);
    await waitFor(() => expect(commerceApi.sendOtp).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
  });

  it('"Change number" goes back to the phone step', async () => {
    open();
    await toCodeStep();
    await userEvent.click(screen.getByRole('button', { name: 'Change number' }));
    expect(screen.getByLabelText('Mobile number')).toBeInTheDocument();
  });

  it('a signed-in visitor is sent straight on', async () => {
    useCustomerStore.setState({ customer: me, token: 't', status: 'authed' });
    open('/login?next=%2Faccount');
    await waitFor(() => expect(currentUrl()).toBe('/account'));
  });
});
