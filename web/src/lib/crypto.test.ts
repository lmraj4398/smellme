import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { decryptPayload, encryptPayload, isEncryptedPayload } from './crypto';

const KEY = Buffer.from('a'.repeat(64), 'hex'); // matches vite.config.ts test.env

// Mirrors api/src/common/crypto/aes.ts exactly.
function serverEncrypt(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', KEY, iv);
  const ct = Buffer.concat([c.update(text, 'utf8'), c.final()]);
  return { data: Buffer.concat([ct, c.getAuthTag()]).toString('base64'), iv: iv.toString('base64'), ts: Date.now() };
}
function serverDecrypt(p: { data: string; iv: string }) {
  const buf = Buffer.from(p.data, 'base64');
  const d = createDecipheriv('aes-256-gcm', KEY, Buffer.from(p.iv, 'base64'));
  d.setAuthTag(buf.subarray(-16));
  return d.update(buf.subarray(0, -16)).toString('utf8') + d.final('utf8');
}

describe('browser <-> API crypto interop', () => {
  it('decrypts what the server encrypted', async () => {
    const out = await decryptPayload(serverEncrypt(JSON.stringify({ price: '₹2,850', ok: true })));
    expect(out).toEqual({ price: '₹2,850', ok: true });
  });

  it('is decryptable by the server', async () => {
    const p = await encryptPayload({ phone: '9876543210' });
    expect(JSON.parse(serverDecrypt(p))).toEqual({ phone: '9876543210' });
  });

  it('detects the envelope', async () => {
    expect(isEncryptedPayload(await encryptPayload({}))).toBe(true);
    expect(isEncryptedPayload({ message: 'x' })).toBe(false);
  });
});
