import type { CookieOptions, Request, Response } from 'express';
import { isProductionEnv } from '../../common/utils/env.util';

const REFRESH_COOKIE = 'sm_rt';

// Scoped to /api/auth so the browser never sends it to any other endpoint.
// SameSite=Lax is enough: admin.<domain> and api.<domain> are the same site,
// while a cross-site POST (the CSRF case) does not carry a Lax cookie.
function options(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: isProductionEnv(process.env.NODE_ENV),
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: maxAgeMs,
  };
}

export const setRefreshCookie = (res: Response, token: string, days: number) =>
  res.cookie(REFRESH_COOKIE, token, options(days * 24 * 60 * 60 * 1000));

export const clearRefreshCookie = (res: Response) => res.clearCookie(REFRESH_COOKIE, options(0));

export const readRefreshCookie = (req: Request): string | undefined => {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[REFRESH_COOKIE];
  return typeof v === 'string' && v.length > 0 && v.length < 200 ? v : undefined;
};
