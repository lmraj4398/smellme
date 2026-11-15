import { canOpen, NAV } from './nav-routes';
import type { AuthUser } from '@/store/auth.store';

const user = (screens: string[] | null): AuthUser => ({ id: '1', name: 'U', email: 'u@x.in', screens });
const find = (p: string) => NAV.find((n) => n.path === p)!;

describe('canOpen', () => {
  it('unrestricted login opens everything', () => NAV.forEach((n) => expect(canOpen(user(null), n)).toBe(true)));

  it('restricted login opens only its screens, plus the dashboard', () => {
    const u = user(['products', 'content']);
    expect(NAV.filter((n) => canOpen(u, n)).map((n) => n.path)).toEqual([
      '/', '/products', '/brands', '/content', '/faqs',
    ]);
  });

  it('a restricted login cannot reach order or settings pages', () => {
    expect(canOpen(user(['products']), find('/orders'))).toBe(false);
    expect(canOpen(user(['products']), find('/settings'))).toBe(false);
  });

  it('owner-only pages are hidden from every restricted login, even one holding all screens', () => {
    const all = ['orders', 'products', 'inventory', 'customers', 'coupons', 'reviews', 'content', 'marketing', 'logs', 'settings'];
    expect(canOpen(user(all), find('/logins'))).toBe(false);
    expect(canOpen(user(null), find('/logins'))).toBe(true);
  });

  it('anonymous opens nothing', () => expect(canOpen(null, find('/'))).toBe(false));

  it('paths are unique', () => expect(new Set(NAV.map((n) => n.path)).size).toBe(NAV.length));
});
