export interface SiteRoute {
  path: string;
  title: string;
  /** Shown in the main navigation. */
  nav?: string;
}

// Mirrors the page list in the original static prototype. `/order/:orderNo`
// replaces "Order confirmed": with manual UPI payment, the order page is where
// the customer sees the QR, the exact amount, uploads the receipt, and then
// tracks verification and shipping.
export const ROUTES: SiteRoute[] = [
  { path: '/', title: 'Home', nav: 'Home' },
  { path: '/shop', title: 'Shop all fragrances', nav: 'Shop all' },
  { path: '/product/:slug', title: 'Product' },
  { path: '/scent-finder', title: 'Scent finder', nav: 'Scent finder' },
  { path: '/gifting', title: 'Gifting', nav: 'Gifting' },
  { path: '/our-story', title: 'Our story', nav: 'Our story' },
  { path: '/help', title: 'Help & FAQ' },
  { path: '/bag', title: 'Your bag' },
  { path: '/checkout', title: 'Checkout' },
  { path: '/order/:orderNo', title: 'Your order' },
  { path: '/login', title: 'Sign in' },
  { path: '/account', title: 'My account' },
];

export const NAV_ITEMS = ROUTES.filter((r) => r.nav);
