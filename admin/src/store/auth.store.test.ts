import { canOpenScreen, useAuthStore, type AuthUser } from './auth.store';

const owner: AuthUser = { id: '1', name: 'O', email: 'o@x.in', screens: null };
const limited: AuthUser = { ...owner, screens: ['products', 'content'] };

describe('canOpenScreen()', () => {
  it('lets an unrestricted login open every screen', () => expect(canOpenScreen(owner, 'orders')).toBe(true));
  it('limits a restricted login to its listed screens', () => {
    expect(canOpenScreen(limited, 'products')).toBe(true);
    expect(canOpenScreen(limited, 'orders')).toBe(false);
  });
  it('lets any signed-in user open screens that need no grant', () => expect(canOpenScreen(limited)).toBe(true));
  it('denies anonymous users', () => expect(canOpenScreen(null, 'products')).toBe(false));
});

describe('auth store', () => {
  it('never persists the token', () => {
    useAuthStore.getState().setAuth(owner, 'secret-token-value');
    expect(JSON.stringify(localStorage)).not.toContain('secret-token-value');
    useAuthStore.getState().clear();
    expect(useAuthStore.getState()).toMatchObject({ token: null, status: 'anon' });
  });
});
