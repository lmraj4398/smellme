import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { R2_FOLDERS, R2Folder, R2FolderRule, r2KeyPattern } from './r2.folders';

export interface PresignedUpload {
  key: string;
  upload_url: string;
  /** Only for public folders. */
  public_url?: string;
  /** The browser must send exactly these headers on the PUT, or R2 rejects the signature. */
  headers: Record<string, string>;
  expires_in: number;
}

const IMMUTABLE = 'public, max-age=31536000, immutable';
const UPLOAD_URL_TTL = 300;

/**
 * The one place that talks to Cloudflare R2 (S3 API). Everything that stores or shows a file goes through here:
 * product media, site images, payment receipts, and anything added to R2_FOLDERS later.
 * Browsers upload straight to R2 with a signed URL, so the API never handles the bytes (use `put` only for files
 * the server makes itself, such as a generated PDF).
 */
@Injectable()
export class R2Service {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  private rule(folder: R2Folder): R2FolderRule {
    return R2_FOLDERS[folder];
  }

  private bucket(folder: R2Folder): string {
    return this.config.getOrThrow<string>(this.rule(folder).visibility === 'public' ? 'R2_PUBLIC_BUCKET' : 'R2_PRIVATE_BUCKET');
  }

  /** True when every setting this folder needs is present (account + keys + its bucket, and the public URL for public ones). */
  isConfigured(folder: R2Folder): boolean {
    const isPublic = this.rule(folder).visibility === 'public';
    const keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', isPublic ? 'R2_PUBLIC_BUCKET' : 'R2_PRIVATE_BUCKET'];
    if (isPublic) keys.push('R2_PUBLIC_URL');
    return keys.every((k) => !!this.config.get<string>(k));
  }

  /** Where a public key is served from. `publicUrl('')` is the base URL. */
  publicUrl(key: string): string {
    return `${(this.config.get<string>('R2_PUBLIC_URL') ?? '').replace(/\/+$/, '')}/${key}`;
  }

  keyPattern(folder: R2Folder, scopeId?: string): RegExp {
    return r2KeyPattern(folder, scopeId);
  }

  isValidKey(folder: R2Folder, key: string, scopeId?: string): boolean {
    return this.keyPattern(folder, scopeId).test(key);
  }

  /** Checks type and size against the folder rule and returns the extension to store it under. Throws a 400/503. */
  private check(folder: R2Folder, contentType: string, size: number): string {
    const rule = this.rule(folder);
    if (!this.isConfigured(folder)) throw new HttpException(rule.unavailableMessage, HttpStatus.SERVICE_UNAVAILABLE);
    const ext = rule.types[contentType];
    if (!ext) throw new HttpException(rule.typeMessage, HttpStatus.BAD_REQUEST);
    if (!Number.isInteger(size) || size <= 0 || size > rule.maxBytes) throw new HttpException(rule.sizeMessage, HttpStatus.BAD_REQUEST);
    return ext;
  }

  private newKey(folder: R2Folder, ext: string, scopeId?: string): string {
    const rule = this.rule(folder);
    // Building the pattern validates the scope id, so a bad id can never end up inside a key.
    this.keyPattern(folder, scopeId);
    return `${rule.prefix}/${rule.scoped ? `${scopeId}/` : ''}${randomUUID()}.${ext}`;
  }

  /** A signed PUT URL for ONE file of the declared type and size, under a key we generate. */
  async presignUpload(folder: R2Folder, contentType: string, size: number, scopeId?: string): Promise<PresignedUpload> {
    const ext = this.check(folder, contentType, size);
    const key = this.newKey(folder, ext, scopeId);
    const isPublic = this.rule(folder).visibility === 'public';
    // ContentType and ContentLength are part of the signature: the upload must be the type and size validated here.
    const upload_url = await getSignedUrl(
      this.s3(),
      new PutObjectCommand({
        Bucket: this.bucket(folder),
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        ...(isPublic ? { CacheControl: IMMUTABLE } : {}),
      }),
      { expiresIn: UPLOAD_URL_TTL, unhoistableHeaders: new Set(['content-length']) },
    );
    return {
      key,
      upload_url,
      ...(isPublic ? { public_url: this.publicUrl(key) } : {}),
      headers: { 'Content-Type': contentType, ...(isPublic ? { 'Cache-Control': IMMUTABLE } : {}) },
      expires_in: UPLOAD_URL_TTL,
    };
  }

  /** For files the server creates itself (e.g. a generated PDF). Same rules and key shape as a browser upload. */
  async put(folder: R2Folder, body: Buffer, contentType: string, scopeId?: string): Promise<{ key: string; url?: string }> {
    const ext = this.check(folder, contentType, body.length);
    const key = this.newKey(folder, ext, scopeId);
    const isPublic = this.rule(folder).visibility === 'public';
    await this.s3().send(
      new PutObjectCommand({ Bucket: this.bucket(folder), Key: key, Body: body, ContentType: contentType, ...(isPublic ? { CacheControl: IMMUTABLE } : {}) }),
    );
    return { key, ...(isPublic ? { url: this.publicUrl(key) } : {}) };
  }

  /** Confirms the browser really uploaded the object, and how big / what type it is. Null = not there. */
  async head(folder: R2Folder, key: string): Promise<{ size: number; contentType: string } | null> {
    try {
      const r = await this.s3().send(new HeadObjectCommand({ Bucket: this.bucket(folder), Key: key }));
      return { size: r.ContentLength ?? 0, contentType: r.ContentType ?? '' };
    } catch {
      return null;
    }
  }

  /** Short-lived link to read a file in a private folder. The bucket itself stays private. */
  signedGetUrl(folder: R2Folder, key: string, expiresIn = 300): Promise<string> {
    return getSignedUrl(this.s3(), new GetObjectCommand({ Bucket: this.bucket(folder), Key: key }), { expiresIn });
  }

  /** Best-effort cleanup. Does nothing when R2 is not set up or the key is not one we generated. */
  async delete(folder: R2Folder, key: string): Promise<void> {
    if (!this.isConfigured(folder)) return;
    // A scoped key carries its own scope id (e.g. the order id); take it from the key, then shape-check the whole key.
    const scopeId = this.rule(folder).scoped ? key.split('/')[1] : undefined;
    try {
      if (!this.isValidKey(folder, key, scopeId)) return;
    } catch {
      return; // the scope part was not a UUID
    }
    await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket(folder), Key: key }));
  }

  private s3(): S3Client {
    this.client ??= new S3Client({
      region: 'auto',
      // Newer SDKs add a CRC32 of an EMPTY body to presigned URLs, which then mismatches the real upload.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      endpoint: `https://${this.config.getOrThrow<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.config.getOrThrow<string>('R2_SECRET_ACCESS_KEY'),
      },
    });
    return this.client;
  }
}
