import { createCorsOrigin } from './cors.config';

const check = (fn: ReturnType<typeof createCorsOrigin>, origin?: string) =>
  new Promise<boolean>((res) => fn(origin, (_e, ok) => res(!!ok)));

describe('cors', () => {
  const fn = createCorsOrigin({
    websiteUrl: 'https://smellme.in/',
    adminUrl: 'https://admin.smellme.in',
    extraOrigins: 'https://www.smellme.in, ',
  });

  it('allows configured origins, ignoring trailing slashes', async () => {
    expect(await check(fn, 'https://smellme.in')).toBe(true);
    expect(await check(fn, 'https://admin.smellme.in/')).toBe(true);
    expect(await check(fn, 'https://www.smellme.in')).toBe(true);
  });

  it('rejects everything else, including look-alike hosts', async () => {
    expect(await check(fn, 'https://evil.com')).toBe(false);
    expect(await check(fn, 'https://smellme.in.evil.com')).toBe(false);
  });

  it('allows requests without an Origin header', async () => {
    expect(await check(fn, undefined)).toBe(true);
  });
});
