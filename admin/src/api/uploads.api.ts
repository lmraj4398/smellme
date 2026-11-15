import { api } from './client';
import { compressImage } from '@/lib/image';

interface Presigned {
  key: string; upload_url: string; public_url: string; headers: Record<string, string>; expires_in: number;
}

/** Shrinks the image, asks the API for a signed R2 URL, uploads straight to R2, returns the object key + public URL. */
export async function uploadImage(file: File): Promise<{ key: string; url: string }> {
  const blob = await compressImage(file);
  const { data } = await api.post<Presigned>('/admin/uploads/presign', { content_type: blob.type, size: blob.size });
  // Plain fetch, not `api`: this goes to R2, not our API (no auth header, no encryption).
  // The headers must be exactly those that were signed.
  const res = await fetch(data.upload_url, { method: 'PUT', headers: data.headers, body: blob });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
  return { key: data.key, url: data.public_url };
}
