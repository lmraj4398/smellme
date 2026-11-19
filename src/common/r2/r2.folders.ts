// Every kind of file SmellMe stores in Cloudflare R2 is one entry here. To add an upload type (brand logos, PDFs, ...)
// add a folder rule: R2Service then signs, validates, reads and deletes it with no other code.
//
//   public  bucket (R2_PUBLIC_BUCKET) + R2_PUBLIC_URL: served to everyone, cached for a year (keys are never reused).
//   private bucket (R2_PRIVATE_BUCKET): never public; staff look at a file through a short-lived signed link.

export interface R2FolderRule {
  /** First path segment of every key in this folder. */
  prefix: string;
  visibility: 'public' | 'private';
  /** Allowed content types -> the file extension we store them under. The extension is never taken from the client. */
  types: Record<string, string>;
  maxBytes: number;
  /** true: keys are `<prefix>/<scopeId>/<uuid>.<ext>` so a file can only be attached to the record it was uploaded for. */
  scoped: boolean;
  /** Messages shown to the user (they are the API's 400 / 503 texts). */
  typeMessage: string;
  sizeMessage: string;
  unavailableMessage: string;
}

const MB = 1024 * 1024;

export const R2_FOLDERS = {
  /** Product photos and the images on Home / Gifting / Our story / Help (edited in the admin panel). */
  media: {
    prefix: 'media',
    visibility: 'public',
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' },
    maxBytes: 5 * MB,
    scoped: false,
    typeMessage: 'Only JPEG, PNG, WebP or AVIF images are allowed',
    sizeMessage: 'Image must be 5 MB or smaller',
    unavailableMessage: 'Image storage is not configured',
  },
  /** UPI payment receipts uploaded by customers. Scope = the order id. */
  receipts: {
    prefix: 'receipts',
    visibility: 'private',
    types: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' },
    maxBytes: 5 * MB,
    scoped: true,
    typeMessage: 'Upload a JPEG, PNG, WebP image or a PDF',
    sizeMessage: 'The file must be 5 MB or smaller',
    unavailableMessage: 'Receipt upload is not available right now',
  },
} as const satisfies Record<string, R2FolderRule>;

export type R2Folder = keyof typeof R2_FOLDERS;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const UUID_RE = new RegExp(`^${UUID}$`);

/** The exact shape of a key we generate. Anything else is refused when a key is later saved against a record. */
export function r2KeyPattern(folder: R2Folder, scopeId?: string): RegExp {
  const rule: R2FolderRule = R2_FOLDERS[folder];
  const exts = [...new Set(Object.values(rule.types))].join('|');
  let scope = '';
  if (rule.scoped) {
    // The id is interpolated into a pattern, so it must be a plain UUID (never regex syntax).
    if (!scopeId || !UUID_RE.test(scopeId)) throw new Error(`"${folder}" keys need a UUID scope id`);
    scope = `${scopeId}/`;
  }
  // `\\.` in a template literal is the regex `\.` (a literal dot); a single `\.` would silently become `.` (any character).
  return new RegExp(`^${rule.prefix}/${scope}${UUID}\\.(${exts})$`);
}

/** Keys of the public media folder (product photos, site images). */
export const MEDIA_KEY = r2KeyPattern('media');
