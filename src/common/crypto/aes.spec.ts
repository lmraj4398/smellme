import { decrypt, encrypt, isEncryptedPayload, MAX_AGE_MS } from './aes';

describe('aes', () => {
  const OLD = process.env.API_ENCRYPTION_KEY;
  beforeAll(() => {
    process.env.API_ENCRYPTION_KEY = 'a'.repeat(64);
  });
  afterAll(() => {
    process.env.API_ENCRYPTION_KEY = OLD;
  });

  it('round-trips unicode text', () => {
    const msg = JSON.stringify({ name: 'Saffron Dusk', price: '₹2,850' });
    expect(decrypt(encrypt(msg))).toBe(msg);
  });

  it('uses a fresh IV every time', () => {
    expect(encrypt('x').iv).not.toBe(encrypt('x').iv);
  });

  it('rejects a tampered ciphertext', () => {
    const p = encrypt('hello');
    const buf = Buffer.from(p.data, 'base64');
    buf[0] ^= 0xff;
    expect(() => decrypt({ ...p, data: buf.toString('base64') })).toThrow();
  });

  it('rejects a payload outside the replay window', () => {
    const p = encrypt('hello');
    expect(() => decrypt({ ...p, ts: Date.now() - MAX_AGE_MS - 1000 })).toThrow(/timestamp/i);
    expect(() => decrypt({ ...p, ts: Date.now() + MAX_AGE_MS + 1000 })).toThrow(/timestamp/i);
  });

  it('fails loudly when the key is missing or the wrong length', () => {
    process.env.API_ENCRYPTION_KEY = 'short';
    expect(() => encrypt('x')).toThrow(/64-char/);
    process.env.API_ENCRYPTION_KEY = 'a'.repeat(64);
  });

  it('detects the envelope shape', () => {
    expect(isEncryptedPayload(encrypt('x'))).toBe(true);
    expect(isEncryptedPayload({ data: 'x' })).toBe(false);
    expect(isEncryptedPayload(null)).toBe(false);
  });
});
