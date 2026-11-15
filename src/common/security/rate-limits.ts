import type { INestApplication } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { createLoginRateLimiters, limitedHandler } from './login-rate-limit';

const MIN = 60 * 1000;

interface RouteLimit {
  /** Matched against req.path (already stripped of the query string). */
  path: RegExp;
  windowMs: number;
  max: number;
  message: string;
  /** false = also enforced in dev (anything that costs money or guards auth). */
  prodOnly: boolean;
}

// Per-IP limits. Per-PHONE limits (OTP) need the parsed body and live in the
// auth module, because these run before body parsing.
//
// /orders is deliberately generous: it is the checkout endpoint, not a
// spam-prone form. A tight ceiling here blocks real customers (retries,
// double-clicks, many people behind one carrier-grade NAT IP).
const ROUTE_LIMITS: RouteLimit[] = [
  { path: /^\/api\/customer\/otp\/send$/, windowMs: 60 * MIN, max: 10, prodOnly: false,
    message: 'Too many OTP requests. Please try again later.' },
  { path: /^\/api\/customer\/otp\/verify$/, windowMs: 15 * MIN, max: 20, prodOnly: false,
    message: 'Too many verification attempts. Please try again later.' },
  { path: /^\/api\/admin\/uploads\/presign$/, windowMs: 15 * MIN, max: 120, prodOnly: true,
    message: 'Too many uploads. Please try again later.' },
  { path: /^\/api\/customer\/orders$/, windowMs: 15 * MIN, max: 30, prodOnly: true,
    message: 'Too many order requests. Please try again later.' },
  { path: /^\/api\/customer\/orders\/[^/]+\/receipt(\/presign)?$/, windowMs: 15 * MIN, max: 20, prodOnly: false,
    message: 'Too many receipt uploads. Please try again later.' },
  { path: /^\/api\/cart\/price$/, windowMs: 15 * MIN, max: 300, prodOnly: true,
    message: 'Too many requests. Please slow down.' },
  { path: /^\/api\/coupons\/validate$/, windowMs: 15 * MIN, max: 20, prodOnly: true,
    message: 'Too many coupon attempts. Please try again later.' },
  { path: /^\/api\/contact$/, windowMs: 15 * MIN, max: 5, prodOnly: true,
    message: 'Too many messages sent. Please try again later.' },
  { path: /^\/api\/newsletter$/, windowMs: 15 * MIN, max: 5, prodOnly: true,
    message: 'Too many subscription attempts. Please try again later.' },
  { path: /^\/api\/products\/[^/]+\/reviews$/, windowMs: 15 * MIN, max: 5, prodOnly: true,
    message: 'Too many review submissions. Please try again later.' },
];

export function applyRateLimits(app: INestApplication, opts: { isProd: boolean; globalMax: number }) {
  const express = app.getHttpAdapter().getInstance();

  express.use(
    rateLimit({
      windowMs: MIN,
      max: opts.globalMax,
      standardHeaders: true,
      legacyHeaders: false,
      handler: limitedHandler('Too many requests. Please slow down.'),
    }),
  );

  // Admin login - failed attempts only.
  const login = createLoginRateLimiters();
  express.use('/api/auth/login', ...login);

  for (const l of ROUTE_LIMITS) {
    if (l.prodOnly && !opts.isProd) continue;
    express.use(
      l.path,
      rateLimit({
        windowMs: l.windowMs,
        max: l.max,
        standardHeaders: true,
        legacyHeaders: false,
        handler: limitedHandler(l.message),
      }),
    );
  }
}
