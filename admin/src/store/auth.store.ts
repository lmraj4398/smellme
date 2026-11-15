import { create } from 'zustand';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /**
   * Admin screens this login may open. `null` = every screen (the owner).
   * One role only: the only restriction is this optional screen list.
   */
  screens: string[] | null;
}

// 'unknown' = haven't tried the refresh cookie yet (first paint after reload).
type AuthStatus = 'unknown' | 'authed' | 'anon';

interface AuthState {
  user: AuthUser | null;
  // Access token lives in memory only. It is never written to localStorage, so
  // an XSS bug can't lift a long-lived credential; reloads restore the session
  // from the httpOnly refresh cookie instead.
  token: string | null;
  status: AuthStatus;
  setAuth: (user: AuthUser, token: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  status: 'unknown',
  setAuth: (user, token) => set({ user, token, status: 'authed' }),
  clear: () => set({ user: null, token: null, status: 'anon' }),
}));

/** `screen` omitted = open to any signed-in user (e.g. the dashboard). */
export function canOpenScreen(user: AuthUser | null, screen?: string): boolean {
  if (!user) return false;
  if (!screen || user.screens === null) return true;
  return user.screens.includes(screen);
}
