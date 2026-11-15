import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageLoader } from '@/components/ui/PageLoader';
import { ScreenRoute } from '@/components/ScreenRoute';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { NAV } from '@/lib/nav-routes';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ProductsPage = lazy(() => import('@/pages/products/ProductsPage'));
const ProductFormPage = lazy(() => import('@/pages/products/ProductFormPage'));
const TaxonomyPage = lazy(() => import('@/pages/catalog/TaxonomyPage'));
const InventoryPage = lazy(() => import('@/pages/inventory/InventoryPage'));
const LoginsPage = lazy(() => import('@/pages/logins/LoginsPage'));
const ContentPage = lazy(() => import('@/pages/content/ContentPage'));
const MessagesPage = lazy(() => import('@/pages/messages/MessagesPage'));
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'));
const OrderDetailPage = lazy(() => import('@/pages/orders/OrderDetailPage'));
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage'));
const ErrorLogsPage = lazy(() => import('@/pages/logs/ErrorLogsPage'));
const CouponsPage = lazy(() => import('@/pages/coupons/CouponsPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const WhatsAppLogPage = lazy(() => import('@/pages/whatsapp/WhatsAppLogPage'));
const CustomersPage = lazy(() => import('@/pages/customers/CustomersPage'));
const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Real pages register here as they are built; everything else in NAV gets the
// placeholder, already behind its permission guard.
const PAGES: Record<string, ReactNode> = {
  '/': <DashboardPage />,
  '/products': <ProductsPage />,
  '/brands': <TaxonomyPage />,
  '/inventory': <InventoryPage />,
  '/logins': <LoginsPage />,
  '/orders': <OrdersPage />,
  '/payments': <OrdersPage initialStatus="PAYMENT_SUBMITTED" fixed title="Verify payments" subtitle="Customers who have paid and uploaded a receipt, oldest first. Check your bank or UPI app, then approve or reject." />,
  '/coupons': <CouponsPage />,
  '/reviews': <ReviewsPage />,
  '/error-logs': <ErrorLogsPage />,
  '/settings': <SettingsPage />,
  '/notifications': <WhatsAppLogPage />,
  '/customers': <CustomersPage />,
  '/content': <ContentPage />,
  '/messages': <MessagesPage />,
  // The FAQ shortcut opens just the questions block of the Help page.
  '/faqs': <ContentPage initialPage="help" onlySection="faq" title="FAQs" subtitle="The questions and answers on the Help page, grouped by topic." />,
};

// Detail routes live under a menu item's screen: if you can open Products, you can open these.
const SUB_ROUTES: { path: string; of: string; element: ReactNode }[] = [
  { path: '/products/new', of: '/products', element: <ProductFormPage /> },
  { path: '/products/:id', of: '/products', element: <ProductFormPage /> },
  { path: '/orders/:id', of: '/orders', element: <OrderDetailPage /> },
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't hammer the API on auth/permission/validation failures.
      retry: (count, err) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        return !(status && status >= 400 && status < 500) && count < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {NAV.map((item) => (
                  <Route
                    key={item.path}
                    path={item.path}
                    element={
                      <ScreenRoute item={item}>{PAGES[item.path] ?? <ComingSoonPage item={item} />}</ScreenRoute>
                    }
                  />
                ))}
                {SUB_ROUTES.map((r) => (
                  <Route key={r.path} path={r.path} element={<ScreenRoute item={NAV.find((n) => n.path === r.of)!}>{r.element}</ScreenRoute>} />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
