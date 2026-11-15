const MAX_SIDE = 1600;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/** Scales the longest side down to 1600px and re-encodes as WebP. Falls back to the original when that isn't smaller. */
export async function compressImage(file: File): Promise<Blob> {
  if (!ALLOWED.includes(file.type)) throw new Error('Use a JPEG, PNG, WebP or AVIF image');
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.85));
    if (out && out.type === 'image/webp' && out.size < file.size) return out;
  } catch {
    /* fall through to the original */
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('Image is over 5 MB and could not be shrunk');
  return file;
}
