import { create } from 'zustand';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  /** YYYY-MM-DD, or null when not given. */
  birthday?: string | null;
}

// 'unknown' = we haven't tried the refresh cookie yet (first paint after a reload).
type SessionStatus = 'unknown' | 'authed' | 'anon';

interface CustomerState {
  customer: Customer | null;
  // In memory only: never in localStorage, so an XSS bug cannot lift a credential.
  // A reload restores the session from the httpOnly refresh cookie instead.
  token: string | null;
  status: SessionStatus;
  setSession: (customer: Customer, token: string) => void;
  setCustomer: (customer: Customer) => void;
  clear: () => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customer: null,
  token: null,
  status: 'unknown',
  setSession: (customer, token) => set({ customer, token, status: 'authed' }),
  setCustomer: (customer) => set({ customer }),
  clear: () => set({ customer: null, token: null, status: 'anon' }),
}));
