import { ConfigService } from '@nestjs/config';
import { MEDIA_KEY, receiptKeyPattern, StorageService } from './storage.service';

const cfg = (over: Record<string, string> = {}) =>
  new ConfigService({
    R2_ACCOUNT_ID: 'acct123',
    R2_ACCESS_KEY_ID: 'AKIA',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_PUBLIC_BUCKET: 'smellme-public',
    R2_PUBLIC_URL: 'https://cdn.smellme.in/',
    ...over,
  });

describe('StorageService', () => {
  it('signs a PUT for the declared type and size only, under a generated key', async () => {
    const out = await new StorageService(cfg()).presignImageUpload('image/webp', 123456);
    expect(out.key).toMatch(MEDIA_KEY);
    expect(out.public_url).toBe(`https://cdn.smellme.in/${out.key}`);
    const u = new URL(out.upload_url);
    expect(u.host).toBe('smellme-public.acct123.r2.cloudflarestorage.com');
    expect(u.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toMatch(/content-length/);
    expect(out.headers['Content-Type']).toBe('image/webp');
  });

  it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'text/html'])('rejects %s', async (t) => {
    await expect(new StorageService(cfg()).presignImageUpload(t, 1000)).rejects.toThrow(/JPEG, PNG, WebP or AVIF/);
  });

  it.each([0, -1, 5 * 1024 * 1024 + 1, 1.5])('rejects size %s', async (n) => {
    await expect(new StorageService(cfg()).presignImageUpload('image/png', n)).rejects.toThrow(/5 MB/);
  });

  it('reports 503 when R2 is not configured', async () => {
    const s = new StorageService(cfg({ R2_ACCOUNT_ID: '' }));
    expect(s.isConfigured()).toBe(false);
    await expect(s.presignImageUpload('image/png', 10)).rejects.toThrow(/not configured/);
  });

  it('only accepts keys in the exact generated shape', () => {
    expect(MEDIA_KEY.test('media/0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab.jpg')).toBe(true);
    for (const bad of ['../etc/passwd', 'media/x.jpg', 'media/0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab.svg', 'receipts/0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab.jpg']) {
      expect(MEDIA_KEY.test(bad)).toBe(false);
    }
  });
});

describe('receipt keys', () => {
  const order = '0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab';
  const other = '99999999-1a2b-4c3d-8e9f-0123456789ab';
  const file = '1f2e3d4c-5b6a-4789-8abc-def012345678';
  const re = receiptKeyPattern(order);

  it("accepts only this order's own receipts, with a real dot before the extension", () => {
    expect(re.test(`receipts/${order}/${file}.jpg`)).toBe(true);
    expect(re.test(`receipts/${order}/${file}.pdf`)).toBe(true);
    expect(re.test(`receipts/${order}/${file}xjpg`)).toBe(false); // an unescaped "." would let this through
    expect(re.test(`receipts/${order}/${file}.svg`)).toBe(false);
    expect(re.test(`receipts/${other}/${file}.jpg`)).toBe(false); // another order's folder
    expect(re.test(`media/${file}.jpg`)).toBe(false);
    expect(re.test(`receipts/${order}/../${other}/${file}.jpg`)).toBe(false);
  });

  it('refuses to build a pattern from anything but a UUID', () => {
    expect(() => receiptKeyPattern('.*')).toThrow();
    expect(() => receiptKeyPattern(`${order}|x`)).toThrow();
  });
});
