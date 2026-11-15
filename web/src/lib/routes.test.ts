import { NAV_ITEMS, ROUTES } from './routes';

describe('site routes', () => {
  it('has unique paths', () => {
    const paths = ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('keeps the five main nav entries from the design', () => {
    expect(NAV_ITEMS.map((n) => n.nav)).toEqual(['Home', 'Shop all', 'Scent finder', 'Gifting', 'Our story']);
  });

  it('has no static order-confirmed page (orders are tracked by number)', () => {
    expect(ROUTES.some((r) => r.path === '/order-confirmed')).toBe(false);
    expect(ROUTES.some((r) => r.path === '/order/:orderNo')).toBe(true);
  });
});
