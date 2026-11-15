import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { decryptPayload, encryptPayload, encryptionEnabled, isEncryptedPayload } from '@/lib/crypto';
import { useCustomerStore, type Customer } from '@/store/customer.store';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

// withCredentials: the customer refresh cookie rides on /customer/* calls.
export const api = axios.create({ baseURL: BASE, withCredentials: true, timeout: 30_000 });

const CONNECTIVITY_TOAST_ID = 'network-status';

api.interceptors.request.use((config) => {
  const token = useCustomerStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Encrypt JSON bodies. Skips FormData, empty bodies and already-encrypted bodies (the 401-retry path).
api.interceptors.request.use(async (config) => {
  const body = config.data;
  if (!encryptionEnabled() || body == null || body instanceof FormData || isEncryptedPayload(body)) return config;
  config.data = await encryptPayload(body);
  return config;
});

// Public catalog/content responses are plain (CDN-cacheable); private ones are encrypted. Decrypt whichever arrives.
api.interceptors.response.use(
  async (r) => {
    if (isEncryptedPayload(r.data)) r.data = await decryptPayload(r.data);
    return r;
  },
  async (err: AxiosError) => {
    if (!err.response) toast.error('Connection problem - check your internet and try again.', { id: CONNECTIVITY_TOAST_ID });
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

// ── Session refresh ─────────────────────────────────────────────────────────
// Refresh tokens ROTATE (single use), so two refreshes with the same cookie would log the shopper out.
// One in-flight promise per tab, and the Web Locks API serialises tabs.
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) return navigator.locks.request('smellme-customer-refresh', fn);
  return fn();
}

export interface CustomerSession { token: string; customer: Customer }

async function requestRefresh(): Promise<CustomerSession> {
  const res = await axios.post(`${BASE}/customer/refresh`, {}, { withCredentials: true, timeout: 30_000 });
  return (isEncryptedPayload(res.data) ? await decryptPayload(res.data) : res.data) as CustomerSession;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Only a real 401 means the session is gone. A blip or 5xx says nothing about it, so retry before signing anyone out.
async function refreshWithRetry(): Promise<CustomerSession> {
  for (let i = 1; ; i++) {
    try {
      return await requestRefresh();
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 401 || i === 3) throw err;
      await sleep(i * 600);
    }
  }
}

let pending: Promise<CustomerSession> | null = null;

/** Restores/rotates the customer session from the refresh cookie. Safe to call concurrently. */
export function refreshCustomerSession(): Promise<CustomerSession> {
  if (!pending) {
    pending = withLock(refreshWithRetry)
      .then((s) => {
        useCustomerStore.getState().setSession(s.customer, s.token);
        return s;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

type Retriable = InternalAxiosRequestConfig & { _retried?: boolean };
const AUTH_PATHS = /^\/customer\/(otp|refresh|logout)/;

api.interceptors.response.use(undefined, async (err: AxiosError) => {
  const original = err.config as Retriable | undefined;
  const isCustomerCall = original?.url?.startsWith('/customer/') && !AUTH_PATHS.test(original.url);
  if (err.response?.status !== 401 || !original || original._retried || !isCustomerCall) return Promise.reject(err);

  original._retried = true;
  try {
    const s = await refreshCustomerSession();
    original.headers.Authorization = `Bearer ${s.token}`;
    return api(original);
  } catch (refreshErr) {
    if (axios.isAxiosError(refreshErr) && refreshErr.response?.status === 401) useCustomerStore.getState().clear();
    return Promise.reject(err);
  }
});
