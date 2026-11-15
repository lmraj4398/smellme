import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { SiteLayout } from '@/components/layout/SiteLayout';
import { RequireCustomer, SessionBootstrap } from '@/components/RequireCustomer';
import { ROUTES } from '@/lib/routes';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ShopPage = lazy(() => import('@/pages/ShopPage'));
const ProductPage = lazy(() => import('@/pages/ProductPage'));
const ScentFinderPage = lazy(() => import('@/pages/ScentFinderPage'));
const GiftingPage = lazy(() => import('@/pages/GiftingPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const HelpPage = lazy(() => import('@/pages/HelpPage'));
const BagPage = lazy(() => import('@/pages/BagPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const OrderPage = lazy(() => import('@/pages/OrderPage'));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const PlaceholderPage = lazy(() => import('@/pages/PlaceholderPage'));

const BUILT = new Set(['/', '/shop', '/product/:slug', '/scent-finder', '/gifting', '/our-story', '/help', '/bag', '/login', '/checkout', '/order/:orderNo', '/account']);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
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
      <BrowserRouter>
        <SessionBootstrap />
        <Suspense fallback={<div className="min-h-[60vh]" />}>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="/shop" element={<ShopPage />} />
              <Route path="/product/:slug" element={<ProductPage />} />
              <Route path="/scent-finder" element={<ScentFinderPage />} />
              <Route path="/gifting" element={<GiftingPage />} />
              <Route path="/our-story" element={<AboutPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/bag" element={<BagPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireCustomer />}>
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order/:orderNo" element={<OrderPage />} />
                <Route path="/account" element={<AccountPage />} />
              </Route>
              {ROUTES.filter((r) => !BUILT.has(r.path)).map((r) => (
                <Route key={r.path} path={r.path} element={<PlaceholderPage title={r.title} />} />
              ))}
              <Route path="*" element={<PlaceholderPage title="Page not found" />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
    </QueryClientProvider>
  );
}
