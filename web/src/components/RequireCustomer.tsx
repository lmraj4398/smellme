import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { refreshCustomerSession } from '@/api/client';
import { Loading } from '@/components/ui/States';
import { useCustomerStore } from '@/store/customer.store';

/** Restores a signed-in shopper after a reload by trying the httpOnly refresh cookie once. Renders nothing. */
export function SessionBootstrap() {
  useEffect(() => {
    if (useCustomerStore.getState().status !== 'unknown') return;
    refreshCustomerSession().catch(() => useCustomerStore.getState().clear());
  }, []);
  return null;
}

/** Pages that need a signed-in customer. Sends everyone else to sign in, then back here. */
export function RequireCustomer() {
  const status = useCustomerStore((s) => s.status);
  const { pathname, search } = useLocation();
  if (status === 'unknown') return <Loading />;
  if (status === 'anon') return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  return <Outlet />;
}
