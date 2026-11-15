import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Footer } from './Footer';
import { Header } from './Header';

export function SiteLayout() {
  const { pathname } = useLocation();
  // New page = start at the top (the prototype did the same on every route change).
  // Braces matter: newer browsers return a Promise from scrollTo, and an effect's return value is its clean-up
  // function, so `() => window.scrollTo(0, 0)` crashes React with "destroy is not a function" and a blank page.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
