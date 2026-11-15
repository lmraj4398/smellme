import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { api, refreshCustomerSession } from './client';
import { useCustomerStore } from '@/store/customer.store';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const me = { id: 'c1', name: 'Anaya', phone: '+919876543210', email: '' };
const fail = (config: InternalAxiosRequestConfig, status: number) =>
  new AxiosError(String(status), 'ERR', config, null, { status, statusText: '', data: { message: 'no' }, headers: {}, config });

let seen: { url?: string; auth?: string }[];
// Fake server: customer routes accept only "Bearer fresh"; the public pricing route answers anyone.
const adapter: AxiosAdapter = async (config) => {
  seen.push({ url: config.url, auth: String(config.headers.Authorization ?? '') });
  if (config.url === '/cart/price') return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
  if (config.url?.startsWith('/customer/') && config.headers.Authorization !== 'Bearer fresh') throw fail(config, 401);
  return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
};

describe('customer API client', () => {
  let refresh: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    seen = [];
    api.defaults.adapter = adapter;
    useCustomerStore.getState().setSession(me, 'stale');
    refresh = vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: 'fresh', customer: me } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('attaches the bearer token', async () => {
    useCustomerStore.getState().setSession(me, 'fresh');
    await api.get('/customer/orders');
    expect(seen[0].auth).toBe('Bearer fresh');
  });

  it('on 401 refreshes once and retries with the new token', async () => {
    await api.get('/customer/orders');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(seen.map((s) => s.auth)).toEqual(['Bearer stale', 'Bearer fresh']);
    expect(useCustomerStore.getState().token).toBe('fresh');
  });

  it('shares ONE refresh between simultaneous 401s (refresh tokens are single-use)', async () => {
    await Promise.all([api.get('/customer/orders'), api.get('/customer/addresses'), api.get('/customer/me')]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('signs out when the refresh itself is rejected with 401', async () => {
    refresh.mockRejectedValue(fail({ headers: {} } as InternalAxiosRequestConfig, 401));
    await expect(api.get('/customer/orders')).rejects.toBeTruthy();
    expect(useCustomerStore.getState()).toMatchObject({ status: 'anon', token: null, customer: null });
  });

  it('does NOT sign out on a transient failure (network or 5xx): it retries first', async () => {
    vi.useFakeTimers();
    refresh.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    const p = api.get('/customer/orders').catch((e) => e);
    await vi.runAllTimersAsync();
    expect(await p).toBeTruthy();
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(useCustomerStore.getState().status).toBe('authed');
    vi.useRealTimers();
  });

  it('a failed sign-in or code check never triggers a refresh', async () => {
    api.defaults.adapter = async (config) => { throw fail(config, 401); };
    await expect(api.post('/customer/otp/verify', { phone: '9', code: '1' })).rejects.toBeTruthy();
    await expect(api.post('/customer/refresh')).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('public routes never trigger a refresh, signed in or not', async () => {
    useCustomerStore.getState().clear();
    await api.post('/cart/price', { lines: [] });
    expect(refresh).not.toHaveBeenCalled();
    expect(seen[0].auth).toBe('');
  });

  it('refreshCustomerSession() stores the session', async () => {
    useCustomerStore.getState().clear();
    await refreshCustomerSession();
    expect(useCustomerStore.getState()).toMatchObject({ status: 'authed', token: 'fresh' });
  });

  it('keeps the access token out of localStorage', () => {
    useCustomerStore.getState().setSession(me, 'secret-access-token');
    expect(JSON.stringify(localStorage)).not.toContain('secret-access-token');
  });
});
