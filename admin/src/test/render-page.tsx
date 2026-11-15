import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '@/store/auth.store';

export function signIn(user: Partial<AuthUser> = {}) {
  useAuthStore.getState().setAuth({ id: 'me', name: 'Owner', email: 'o@x.in', screens: null, ...user }, 'tok');
}

/** Renders a page inside a fresh query client (no retries, no cache sharing) and a router. */
export function renderPage(ui: ReactElement, opts: { path?: string; route?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opts.route ?? '/']}>
        <Routes>
          <Route path={opts.path ?? '/'} element={ui} />
          <Route path="*" element={<div>elsewhere</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
