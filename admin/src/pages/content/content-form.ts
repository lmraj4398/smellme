import type { Data, Field } from '@/api/content.api';

const DEFAULT_MAX = { text: 200, textarea: 2000 } as const;
const MEDIA_KEY = /^media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|avif)$/;

/** A blank entry for a list: every field empty, nested lists empty. */
export function emptyItem(fields: Field[]): Data {
  return Object.fromEntries(fields.map((f) => [f.key, f.type === 'list' ? [] : '']));
}

export type Errors = Record<string, string>;

/**
 * Same rules as the API (api/src/models/content/content.validate.ts) so problems show beside the
 * field instead of as a failed save. Paths look like "items.2.title" (0-based).
 */
export function validateDraft(fields: Field[], data: Data, prefix = ''): Errors {
  const errors: Errors = {};
  for (const f of fields) {
    const path = `${prefix}${f.key}`;
    const v = data[f.key];
    if (f.type === 'list') {
      const arr = Array.isArray(v) ? (v as Data[]) : [];
      if (arr.length > f.max) errors[path] = `At most ${f.max} ${f.itemLabel}s`;
      arr.forEach((item, i) => Object.assign(errors, validateDraft(f.fields, item, `${path}.${i}.`)));
    } else if (f.type === 'image') {
      if (typeof v === 'string' && v && !MEDIA_KEY.test(v)) errors[path] = 'Not a valid uploaded image';
    } else {
      const s = typeof v === 'string' ? v.trim() : '';
      if (f.required && !s) errors[path] = 'Required';
      else if (s.length > (f.max ?? DEFAULT_MAX[f.type])) errors[path] = `At most ${f.max ?? DEFAULT_MAX[f.type]} characters`;
      else if (/[<>]/.test(s)) errors[path] = 'Cannot contain < or >';
    }
  }
  return errors;
}

export const isDirty = (a: Data, b: Data) => JSON.stringify(a) !== JSON.stringify(b);

/** Immutable set at a path like ["items", 2, "title"]. */
export function setIn<T>(root: T, path: (string | number)[], value: unknown): T {
  if (!path.length) return value as T;
  const [head, ...rest] = path;
  const clone: any = Array.isArray(root) ? [...root] : { ...(root as object) };
  clone[head] = setIn(clone[head], rest, value);
  return clone;
}

export const listOf = (v: unknown): Data[] => (Array.isArray(v) ? (v as Data[]) : []);

/** Renders "*word*" as a plain preview string with the emphasis marked, for the live heading preview. */
export function splitEmphasis(text: string): { text: string; em: boolean }[] {
  const parts = text.split('*');
  const paired = parts.length % 2 === 1 ? parts.length : parts.length - 1; // an unpaired last star emphasises nothing
  return parts
    .map((part, i) => ({ text: i === paired && paired < parts.length ? '*' + part : part, em: i % 2 === 1 && i < paired }))
    .filter((p) => p.text !== '');
}
