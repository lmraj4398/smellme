import type { ReactNode } from 'react';
import { canOpen, type NavItem } from '@/lib/nav-routes';
import { useAuthStore } from '@/store/auth.store';
import NoAccessPage from '@/pages/NoAccessPage';

// UI-level guard only; the API rejects the underlying calls independently.
export function ScreenRoute({ item, children }: { item: NavItem; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return canOpen(user, item) ? <>{children}</> : <NoAccessPage />;
}
