import { redact, safeStringify } from './api-error-logs.service';

describe('error log redaction', () => {
  it('redacts credentials, OTPs, tokens and payment refs at any depth', () => {
    const out = redact({
      email: 'a@b.c',
      password: 'x',
      nested: { otp: '123456', refresh_token: 't', utr: '4021', ok: 1 },
    });
    expect(out).toEqual({
      email: 'a@b.c',
      password: '[redacted]',
      nested: { otp: '[redacted]', refresh_token: '[redacted]', utr: '[redacted]', ok: 1 },
    });
  });

  it('returns null for empty bodies and truncates huge ones', () => {
    expect(safeStringify({})).toBeNull();
    expect(safeStringify(undefined)).toBeNull();
    expect(safeStringify({ a: 'x'.repeat(10000) })!.endsWith('[truncated]')).toBe(true);
  });
});
