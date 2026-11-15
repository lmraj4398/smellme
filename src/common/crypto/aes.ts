import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedPayload {
  data: string;
  iv: string;
  ts: number;
}

// A request older (or further in the future) than this is rejected, which
// bounds how long a captured request can be replayed.
export const MAX_AGE_MS = 5 * 60 * 1000;

function getKey(): Buffer {
  const hex = process.env.API_ENCRYPTION_KEY ?? '';
  if (hex.length !== 64) throw new Error('API_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)');
  return Buffer.from(hex, 'hex');
}

export function encrypt(plaintext: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    data: Buffer.concat([ciphertext, tag]).toString('base64'),
    iv: iv.toString('base64'),
    ts: Date.now(),
  };
}

export function decrypt(payload: EncryptedPayload): string {
  if (Math.abs(Date.now() - payload.ts) > MAX_AGE_MS) {
    throw Object.assign(new Error('Request timestamp expired'), { code: 'TIMESTAMP_EXPIRED' });
  }
  const combined = Buffer.from(payload.data, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = combined.subarray(-16);
  const ciphertext = combined.subarray(0, -16);
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
}

export function isEncryptedPayload(body: unknown): body is EncryptedPayload {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.data === 'string' && typeof b.iv === 'string' && typeof b.ts === 'number';
}
