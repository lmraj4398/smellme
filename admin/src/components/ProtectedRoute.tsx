import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { refreshSession } from '@/api/client';
import { useAuthStore } from '@/store/auth.store';
import { PageLoader } from '@/components/ui/PageLoader';

// Gate for the whole signed-in area. After a reload there is no in-memory
// token, so try the httpOnly refresh cookie once before deciding the visitor
// is signed out.
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  useEffect(() => {
    if (useAuthStore.getState().status !== 'unknown') return;
    refreshSession().catch(() => useAuthStore.getState().clear());
  }, []);

  if (status === 'unknown') return <PageLoader />;
  if (status === 'anon') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
