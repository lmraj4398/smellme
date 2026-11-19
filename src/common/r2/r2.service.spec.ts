import { ConfigService } from '@nestjs/config';
import { MEDIA_KEY, R2_FOLDERS, r2KeyPattern } from './r2.folders';
import { R2Service } from './r2.service';

const cfg = (over: Record<string, string> = {}) =>
  new ConfigService({
    R2_ACCOUNT_ID: 'acct123',
    R2_ACCESS_KEY_ID: 'AKIA',
    R2_SECRET_ACCESS_KEY: 'secret',
    R2_PUBLIC_BUCKET: 'smellme-public',
    R2_PRIVATE_BUCKET: 'smellme-private',
    R2_PUBLIC_URL: 'https://cdn.smellme.in/',
    ...over,
  });
const svc = (over: Record<string, string> = {}) => new R2Service(cfg(over));

const ORDER = '0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab';
const OTHER = '99999999-1a2b-4c3d-8e9f-0123456789ab';
const FILE = '1f2e3d4c-5b6a-4789-8abc-def012345678';

describe('R2Service: public media folder', () => {
  it('signs a PUT for the declared type and size only, under a generated key', async () => {
    const out = await svc().presignUpload('media', 'image/webp', 123456);
    expect(out.key).toMatch(MEDIA_KEY);
    expect(out.public_url).toBe(`https://cdn.smellme.in/${out.key}`);
    const u = new URL(out.upload_url);
    expect(u.host).toBe('smellme-public.acct123.r2.cloudflarestorage.com');
    expect(u.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(u.searchParams.get('X-Amz-SignedHeaders')).toMatch(/content-length/);
    expect(out.headers['Content-Type']).toBe('image/webp');
    expect(out.headers['Cache-Control']).toContain('immutable');
  });

  it.each(['image/gif', 'image/svg+xml', 'application/pdf', 'text/html'])('rejects %s', async (t) => {
    await expect(svc().presignUpload('media', t, 1000)).rejects.toThrow(/JPEG, PNG, WebP or AVIF/);
  });

  it.each([0, -1, 5 * 1024 * 1024 + 1, 1.5])('rejects size %s', async (n) => {
    await expect(svc().presignUpload('media', 'image/png', n)).rejects.toThrow(/5 MB/);
  });

  it('reports 503 when R2 is not configured', async () => {
    const s = svc({ R2_ACCOUNT_ID: '' });
    expect(s.isConfigured('media')).toBe(false);
    await expect(s.presignUpload('media', 'image/png', 10)).rejects.toThrow(/not configured/);
  });

  it('needs the public URL for the public folder, but not for the private one', () => {
    const s = svc({ R2_PUBLIC_URL: '' });
    expect(s.isConfigured('media')).toBe(false);
    expect(s.isConfigured('receipts')).toBe(true);
  });

  it('only accepts keys in the exact generated shape', () => {
    expect(MEDIA_KEY.test('media/0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab.jpg')).toBe(true);
    for (const bad of ['../etc/passwd', 'media/x.jpg', `media/${FILE}.svg`, `receipts/${FILE}.jpg`, `media/${FILE}xjpg`]) {
      expect(MEDIA_KEY.test(bad)).toBe(false);
    }
  });

  it('builds public URLs without double slashes', () => {
    expect(svc().publicUrl('media/a.jpg')).toBe('https://cdn.smellme.in/media/a.jpg');
    expect(svc().publicUrl('')).toBe('https://cdn.smellme.in/');
  });
});

describe('R2Service: private receipts folder', () => {
  it('signs into the private bucket under the order id, with no public URL', async () => {
    const out = await svc().presignUpload('receipts', 'application/pdf', 2048, ORDER);
    expect(out.key).toMatch(new RegExp(`^receipts/${ORDER}/[0-9a-f-]{36}\\.pdf$`));
    expect(out.public_url).toBeUndefined();
    expect(out.headers['Cache-Control']).toBeUndefined();
    expect(new URL(out.upload_url).host).toBe('smellme-private.acct123.r2.cloudflarestorage.com');
  });

  it('rejects types and sizes outside the receipt rule', async () => {
    await expect(svc().presignUpload('receipts', 'image/avif', 10, ORDER)).rejects.toThrow(/JPEG, PNG, WebP image or a PDF/);
    await expect(svc().presignUpload('receipts', 'image/png', R2_FOLDERS.receipts.maxBytes + 1, ORDER)).rejects.toThrow(/5 MB/);
  });

  it('refuses a scoped folder without a UUID scope id', async () => {
    await expect(svc().presignUpload('receipts', 'image/png', 10)).rejects.toThrow(/UUID scope/);
    await expect(svc().presignUpload('receipts', 'image/png', 10, '.*')).rejects.toThrow(/UUID scope/);
  });

  it("accepts only this order's own receipts, with a real dot before the extension", () => {
    const re = r2KeyPattern('receipts', ORDER);
    expect(re.test(`receipts/${ORDER}/${FILE}.jpg`)).toBe(true);
    expect(re.test(`receipts/${ORDER}/${FILE}.pdf`)).toBe(true);
    expect(re.test(`receipts/${ORDER}/${FILE}xjpg`)).toBe(false); // an unescaped "." would let this through
    expect(re.test(`receipts/${ORDER}/${FILE}.svg`)).toBe(false);
    expect(re.test(`receipts/${OTHER}/${FILE}.jpg`)).toBe(false); // another order's folder
    expect(re.test(`media/${FILE}.jpg`)).toBe(false);
    expect(re.test(`receipts/${ORDER}/../${OTHER}/${FILE}.jpg`)).toBe(false);
  });

  it('refuses to build a pattern from anything but a UUID', () => {
    expect(() => r2KeyPattern('receipts', '.*')).toThrow();
    expect(() => r2KeyPattern('receipts', `${ORDER}|x`)).toThrow();
  });
});

describe('R2Service.delete', () => {
  it('does nothing (and does not throw) for keys we did not generate, or when R2 is not set up', async () => {
    const s = svc();
    const spy = jest.spyOn(s as unknown as { s3: () => { send: jest.Mock } }, 's3').mockReturnValue({ send: jest.fn() });
    await s.delete('media', '../etc/passwd');
    await s.delete('receipts', 'receipts/not-a-uuid/x.jpg');
    await svc({ R2_ACCOUNT_ID: '' }).delete('media', `media/${FILE}.jpg`);
    expect(spy).not.toHaveBeenCalled();
  });

  it('deletes a valid key from the right bucket', async () => {
    const s = svc();
    const send = jest.fn();
    jest.spyOn(s as unknown as { s3: () => { send: jest.Mock } }, 's3').mockReturnValue({ send });
    await s.delete('media', `media/${FILE}.png`);
    await s.delete('receipts', `receipts/${ORDER}/${FILE}.pdf`);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'smellme-public', Key: `media/${FILE}.png` });
    expect(send.mock.calls[1][0].input).toEqual({ Bucket: 'smellme-private', Key: `receipts/${ORDER}/${FILE}.pdf` });
  });
});

describe('R2Service.put (server-made files)', () => {
  it('uploads under a generated key and returns the public URL for public folders', async () => {
    const s = svc();
    const send = jest.fn();
    jest.spyOn(s as unknown as { s3: () => { send: jest.Mock } }, 's3').mockReturnValue({ send });
    const out = await s.put('media', Buffer.from('x'), 'image/png');
    expect(out.key).toMatch(MEDIA_KEY);
    expect(out.url).toBe(`https://cdn.smellme.in/${out.key}`);
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: 'smellme-public', ContentType: 'image/png' });
    await expect(s.put('media', Buffer.from('x'), 'text/html')).rejects.toThrow(/JPEG, PNG/);
  });
});
