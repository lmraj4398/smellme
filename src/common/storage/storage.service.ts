import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Keys we generate look exactly like this; anything else is refused when a key
// is later saved against a product, so a client can't point us at an arbitrary object.
export const MEDIA_KEY = /^media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/;

// Payment receipts live in a PRIVATE bucket (no public URL). The key embeds the order id, so a receipt
// can only ever be attached to the order it was uploaded for.
export const RECEIPT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const receiptKeyPattern = (orderId: string) => {
  // The id is interpolated into a pattern, so it must be a plain UUID (never regex syntax).
  if (!new RegExp(`^${UUID}$`).test(orderId)) throw new Error('Invalid order id');
  // `\\.` in a template literal is a regex `\.` (a literal dot); a single `\.` would silently become `.` (any character).
  return new RegExp(`^receipts/${orderId}/${UUID}\\.(jpg|png|webp|pdf)$`);
};

export interface PresignedUpload {
  key: string;
  upload_url: string;
  public_url: string;
  /** The browser must send exactly these headers on the PUT, or R2 rejects the signature. */
  headers: Record<string, string>;
  expires_in: number;
}

// Cloudflare R2 speaks the S3 API. Public bucket = product media, served from R2_PUBLIC_URL.
@Injectable()
export class StorageService {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PUBLIC_BUCKET', 'R2_PUBLIC_URL'].every(
      (k) => !!this.config.get<string>(k),
    );
  }

  publicUrl(key: string): string {
    return `${(this.config.get<string>('R2_PUBLIC_URL') ?? '').replace(/\/+$/, '')}/${key}`;
  }

  async presignImageUpload(contentType: string, size: number): Promise<PresignedUpload> {
    if (!this.isConfigured()) {
      throw new HttpException('Image storage is not configured', HttpStatus.SERVICE_UNAVAILABLE);
    }
    const ext = IMAGE_TYPES[contentType];
    if (!ext) throw new HttpException('Only JPEG, PNG, WebP or AVIF images are allowed', HttpStatus.BAD_REQUEST);
    if (!Number.isInteger(size) || size <= 0 || size > MAX_IMAGE_BYTES) {
      throw new HttpException('Image must be 5 MB or smaller', HttpStatus.BAD_REQUEST);
    }

    const key = `media/${randomUUID()}.${ext}`;
    const expires_in = 300;
    // ContentType and ContentLength are part of the signature: the upload must be
    // the type and size that was declared (and validated) here.
    const upload_url = await getSignedUrl(
      this.s3(),
      new PutObjectCommand({
        Bucket: this.config.getOrThrow<string>('R2_PUBLIC_BUCKET'),
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
      { expiresIn: expires_in, unhoistableHeaders: new Set(['content-length']) },
    );
    return {
      key,
      upload_url,
      public_url: this.publicUrl(key),
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable' },
      expires_in,
    };
  }

  isPrivateConfigured(): boolean {
    return ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_PRIVATE_BUCKET'].every((k) => !!this.config.get<string>(k));
  }

  async presignReceiptUpload(orderId: string, contentType: string, size: number): Promise<Omit<PresignedUpload, 'public_url'>> {
    if (!this.isPrivateConfigured()) throw new HttpException('Receipt upload is not available right now', HttpStatus.SERVICE_UNAVAILABLE);
    const ext = RECEIPT_TYPES[contentType];
    if (!ext) throw new HttpException('Upload a JPEG, PNG, WebP image or a PDF', HttpStatus.BAD_REQUEST);
    if (!Number.isInteger(size) || size <= 0 || size > RECEIPT_MAX_BYTES) throw new HttpException('The file must be 5 MB or smaller', HttpStatus.BAD_REQUEST);
    const key = `receipts/${orderId}/${randomUUID()}.${ext}`;
    const expires_in = 300;
    const upload_url = await getSignedUrl(
      this.s3(),
      new PutObjectCommand({ Bucket: this.config.getOrThrow<string>('R2_PRIVATE_BUCKET'), Key: key, ContentType: contentType, ContentLength: size }),
      { expiresIn: expires_in, unhoistableHeaders: new Set(['content-length']) },
    );
    return { key, upload_url, headers: { 'Content-Type': contentType }, expires_in };
  }

  /** Confirms the customer really uploaded the object, and how big/what type it is. Null = not there. */
  async headReceipt(key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const r = await this.s3().send(new HeadObjectCommand({ Bucket: this.config.getOrThrow<string>('R2_PRIVATE_BUCKET'), Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? '' };
    } catch {
      return null;
    }
  }

  /** Short-lived link for staff to view a receipt. The bucket itself stays private. */
  signedReceiptUrl(key: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(this.s3(), new GetObjectCommand({ Bucket: this.config.getOrThrow<string>('R2_PRIVATE_BUCKET'), Key: key }), { expiresIn });
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.isConfigured() || !MEDIA_KEY.test(key)) return;
    await this.s3().send(
      new DeleteObjectCommand({ Bucket: this.config.getOrThrow<string>('R2_PUBLIC_BUCKET'), Key: key }),
    );
  }

  private s3(): S3Client {
    this.client ??= new S3Client({
      region: 'auto',
      endpoint: `https://${this.config.getOrThrow<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
    return this.client;
  }
}
