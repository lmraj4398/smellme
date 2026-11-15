import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { api, refreshSession } from './client';
import { useAuthStore, type AuthUser } from '@/store/auth.store';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const user: AuthUser = { id: '1', name: 'Owner', email: 'o@x.in', screens: null };

function reject401(config: InternalAxiosRequestConfig) {
  return new AxiosError('401', 'ERR_BAD_REQUEST', config, null, {
    status: 401, statusText: 'Unauthorized', data: { message: 'Unauthorized' }, headers: {}, config,
  });
}

let seen: { url?: string; auth?: string }[];

// Fake server: /orders only accepts "Bearer fresh"; everything else about auth is the client's job.
const adapter: AxiosAdapter = async (config) => {
  seen.push({ url: config.url, auth: String(config.headers.Authorization ?? '') });
  if (config.url === '/orders' && config.headers.Authorization !== 'Bearer fresh') throw reject401(config);
  return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
};

describe('admin api client', () => {
  let refreshPost: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    seen = [];
    api.defaults.adapter = adapter;
    useAuthStore.getState().setAuth(user, 'stale');
    refreshPost = vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: 'fresh', user } });
  });
  afterEach(() => vi.restoreAllMocks());

  it('attaches the bearer token', async () => {
    useAuthStore.getState().setAuth(user, 'fresh');
    await api.get('/orders');
    expect(seen[0].auth).toBe('Bearer fresh');
  });

  it('on 401 refreshes once, then retries the request with the new token', async () => {
    const res = await api.get('/orders');
    expect(res.data).toEqual({ ok: true });
    expect(refreshPost).toHaveBeenCalledTimes(1);
    expect(seen.map((s) => s.auth)).toEqual(['Bearer stale', 'Bearer fresh']);
    expect(useAuthStore.getState().token).toBe('fresh');
  });

  it('shares ONE refresh between simultaneous 401s (refresh tokens are single-use)', async () => {
    await Promise.all([api.get('/orders'), api.get('/orders'), api.get('/orders')]);
    expect(refreshPost).toHaveBeenCalledTimes(1);
  });

  it('signs the user out when the refresh itself is rejected with 401', async () => {
    refreshPost.mockRejectedValue(reject401({ headers: {} } as InternalAxiosRequestConfig));
    await expect(api.get('/orders')).rejects.toBeTruthy();
    expect(useAuthStore.getState()).toMatchObject({ status: 'anon', token: null });
  });

  it('does NOT sign out on a transient refresh failure (network/5xx)', async () => {
    vi.useFakeTimers();
    refreshPost.mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
    const p = api.get('/orders').catch((e) => e);
    await vi.runAllTimersAsync();
    expect(await p).toBeTruthy();
    expect(refreshPost).toHaveBeenCalledTimes(3); // retried before giving up
    expect(useAuthStore.getState().status).toBe('authed');
    vi.useRealTimers();
  });

  it('never tries to refresh for failures of the auth endpoints themselves', async () => {
    api.defaults.adapter = async (config) => {
      throw reject401(config);
    };
    await expect(api.post('/auth/login', { email: 'a@b.c', password: 'x' })).rejects.toBeTruthy();
    expect(refreshPost).not.toHaveBeenCalled();
  });

  it('refreshSession() stores the new session', async () => {
    await refreshSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authed', token: 'fresh' });
  });
});
