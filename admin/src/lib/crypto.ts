// AES-256-GCM, wire-compatible with api/src/common/crypto/aes.ts:
//   data = base64(ciphertext || 16-byte tag), iv = base64(12 bytes), ts = ms epoch.
// The key ships in the JS bundle, so this is obfuscation + replay protection,
// not a secret. HTTPS is the actual transport protection.

export interface EncryptedPayload {
  data: string;
  iv: string;
  ts: number;
}

// Read lazily so tests (and runtime config) can set it after module load.
const keyHex = () => (import.meta.env.VITE_API_ENCRYPTION_KEY as string | undefined) ?? '';

export const encryptionEnabled = () => keyHex().length === 64;

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

let cached: { hex: string; key: CryptoKey } | null = null;

async function getKey(): Promise<CryptoKey> {
  const hex = keyHex();
  if (hex.length !== 64) throw new Error('VITE_API_ENCRYPTION_KEY must be 64 hex chars');
  if (cached?.hex === hex) return cached.key;
  const key = await crypto.subtle.importKey('raw', hexToBytes(hex), { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
  cached = { hex, key };
  return key;
}

export async function encryptPayload(data: unknown): Promise<EncryptedPayload> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { data: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), ts: Date.now() };
}

export async function decryptPayload(payload: EncryptedPayload): Promise<unknown> {
  const key = await getKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.data),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export function isEncryptedPayload(data: unknown): data is EncryptedPayload {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return typeof d.data === 'string' && typeof d.iv === 'string' && typeof d.ts === 'number';
}
