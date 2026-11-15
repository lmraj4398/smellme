import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';

// Two-tier brute-force protection for admin login:
//   short - 5 failed attempts, then a 90 second lock (what an honest user who
//           mistyped meets, with a countdown to show)
//   long  - 20 failed attempts per 15 min, the real brute-force backstop
// Only FAILED attempts count (skipSuccessfulRequests), so staff behind one
// shared IP can't lock each other out by logging in successfully.
const LOGIN_SHORT_WINDOW_MS = 90 * 1000;
const LOGIN_SHORT_MAX = 5;
const LOGIN_LONG_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LONG_MAX = 20;

export function limitedHandler(message: string) {
  return (req: Request, res: Response) => {
    const resetTime = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime;
    const retryAfter = Math.max(1, Math.ceil(((resetTime?.getTime() ?? Date.now() + 1000) - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    // retry_after lets clients show a live countdown instead of a vague "try later".
    res.status(429).json({ statusCode: 429, message, retry_after: retryAfter });
  };
}

function build(windowMs: number, max: number): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: limitedHandler('Too many login attempts. Try again later.'),
  });
}

// Fresh counters per call - each route group gets its own pair.
export function createLoginRateLimiters(): RateLimitRequestHandler[] {
  return [build(LOGIN_SHORT_WINDOW_MS, LOGIN_SHORT_MAX), build(LOGIN_LONG_WINDOW_MS, LOGIN_LONG_MAX)];
}
