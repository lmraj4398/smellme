import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore, type AuthUser } from '@/store/auth.store';
import { decryptPayload, encryptPayload, encryptionEnabled, isEncryptedPayload } from '@/lib/crypto';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

// withCredentials: the httpOnly refresh cookie rides on /auth/* calls.
// timeout: a stalled connection must surface as an error, not hang forever.
export const api = axios.create({ baseURL: BASE, withCredentials: true, timeout: 30_000 });

const CONNECTIVITY_TOAST_ID = 'network-status';
const isNetworkError = (e: unknown) => axios.isAxiosError(e) && !e.response;

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () =>
    toast.error('No internet connection', { id: CONNECTIVITY_TOAST_ID, duration: Infinity }),
  );
  window.addEventListener('online', () => toast.success('Back online', { id: CONNECTIVITY_TOAST_ID }));
}

// ── Requests (axios runs request interceptors last-added-first) ─────────────

// [1] Attach token + screen (so a failing request's server log shows where it came from).
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (typeof window !== 'undefined') config.headers['X-Client-Screen'] = window.location.pathname;
  // React Query owns freshness; don't let the browser HTTP cache serve stale admin data.
  if (config.method === 'get') {
    config.headers['Cache-Control'] = 'no-cache';
    config.headers['Pragma'] = 'no-cache';
  }
  return config;
});

// [2] Encrypt JSON bodies. Runs first. Skips FormData (file uploads are validated
// server-side), empty bodies, and already-encrypted bodies (the 401-retry path).
api.interceptors.request.use(async (config) => {
  const body = config.data;
  if (!encryptionEnabled() || body == null || body instanceof FormData || isEncryptedPayload(body)) return config;
  config.data = await encryptPayload(body);
  return config;
});

// ── Responses ───────────────────────────────────────────────────────────────

api.interceptors.response.use(
  async (r) => {
    if (isEncryptedPayload(r.data)) r.data = await decryptPayload(r.data);
    return r;
  },
  async (err: AxiosError) => {
    if (isNetworkError(err)) toast.error('Connection problem - check your internet and try again.', { id: CONNECTIVITY_TOAST_ID });
    // Error bodies are encrypted too; decrypt so callers see the real message.
    if (err.response && isEncryptedPayload(err.response.data)) {
      try {
        err.response.data = await decryptPayload(err.response.data);
      } catch {
        /* leave raw */
      }
    }
    return Promise.reject(err);
  },
);

// ── Refresh coordination ────────────────────────────────────────────────────
// Refresh tokens ROTATE: a second refresh with the same old token is rejected.
// Two races to prevent:
//   1. Several 401s in one tab  -> share one in-flight promise.
//   2. Two tabs refreshing at once -> serialise across tabs with the Web Locks API.
async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('smellme-auth-refresh', fn);
  }
  return fn();
}

export interface SessionResponse {
  token: string;
  user: AuthUser;
}

// Raw axios (not `api`) so a failing refresh can't recurse into this handler;
// so it must decrypt by hand.
async function requestRefresh(): Promise<SessionResponse> {
  const res = await axios.post(`${BASE}/auth/refresh`, {}, { withCredentials: true, timeout: 30_000 });
  return (isEncryptedPayload(res.data) ? await decryptPayload(res.data) : res.data) as SessionResponse;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Only a real 401 means the session is dead. A network blip or 5xx says nothing
// about the session, so retry briefly before logging anyone out.
async function refreshWithRetry(): Promise<SessionResponse> {
  const attempts = 3;
  for (let i = 1; ; i++) {
    try {
      return await requestRefresh();
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || i === attempts) throw err;
      await sleep(i * 600);
    }
  }
}

let pending: Promise<SessionResponse> | null = null;

/** Restores/rotates the session. Safe to call concurrently. Resolves the new session or throws. */
export function refreshSession(): Promise<SessionResponse> {
  if (!pending) {
    pending = withRefreshLock(refreshWithRetry)
      .then((s) => {
        useAuthStore.getState().setAuth(s.user, s.token);
        return s;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean };

api.interceptors.response.use(undefined, async (err: AxiosError) => {
  const original = err.config as Retriable | undefined;
  const isAuthCall = original?.url?.startsWith('/auth/');
  if (err.response?.status !== 401 || !original || original._retried || isAuthCall) return Promise.reject(err);

  original._retried = true;
  try {
    const s = await refreshSession();
    original.headers.Authorization = `Bearer ${s.token}`;
    return api(original);
  } catch (refreshErr) {
    // Only a definitive 401 logs the user out; transient failures just surface.
    if (axios.isAxiosError(refreshErr) && refreshErr.response?.status === 401) useAuthStore.getState().clear();
    return Promise.reject(err);
  }
});
