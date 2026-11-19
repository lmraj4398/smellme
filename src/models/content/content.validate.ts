import { BadRequestException } from '@nestjs/common';
import { MEDIA_KEY } from '../../common/r2/r2.folders';
import type { Field, SectionSpec } from './content.types';

const DEFAULT_MAX = { text: 200, textarea: 2000 } as const;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, msg: string): never {
  throw new BadRequestException(`${path}: ${msg}`);
}

function cleanFields(fields: Field[], input: unknown, path: string): Obj {
  if (!isObj(input)) fail(path || 'data', 'must be an object');
  // Unknown keys mean a tampered or outdated client - refuse rather than silently drop.
  for (const k of Object.keys(input)) {
    if (!fields.some((f) => f.key === k)) fail(`${path}${k}`, 'is not an editable field');
  }
  const out: Obj = {};
  for (const f of fields) {
    const p = `${path}${f.key}`;
    const v = input[f.key];
    switch (f.type) {
      case 'text':
      case 'textarea': {
        const s = v === undefined || v === null ? '' : v;
        if (typeof s !== 'string') fail(p, 'must be text');
        const t = s.trim();
        if (f.required && !t) fail(p, 'is required');
        const max = f.max ?? DEFAULT_MAX[f.type];
        if (t.length > max) fail(p, `must be at most ${max} characters`);
        // No HTML is ever rendered from content (the website renders text nodes only),
        // but angle brackets have no place in these fields, so don't store them.
        if (/[<>]/.test(t)) fail(p, 'cannot contain < or >');
        out[f.key] = t;
        break;
      }
      case 'image': {
        const s = v === undefined || v === null ? '' : v;
        if (typeof s !== 'string' || (s !== '' && !MEDIA_KEY.test(s))) fail(p, 'is not a valid uploaded image');
        out[f.key] = s;
        break;
      }
      case 'list': {
        const arr = v === undefined || v === null ? [] : v;
        if (!Array.isArray(arr)) fail(p, 'must be a list');
        if (arr.length > f.max) fail(p, `can have at most ${f.max} entries`);
        out[f.key] = arr.map((item, i) => cleanFields(f.fields, item, `${p}[${i + 1}].`));
        break;
      }
    }
  }
  return out;
}

/** Validates and normalises a section save. Throws 400 with a path like "items[2].title: is required". */
export function validateSection(spec: SectionSpec, data: unknown): Obj {
  return cleanFields(spec.fields, data, '');
}

/** Stored values win; any field never saved falls back to the section default. */
export function mergeDefaults(spec: SectionSpec, stored: Obj | null | undefined): Obj {
  const out: Obj = { ...spec.defaults };
  if (stored) for (const f of spec.fields) if (f.key in stored) out[f.key] = stored[f.key];
  return out;
}

/** Replaces image keys with full URLs (recursively), for the public site. */
export function resolveImages(fields: Field[], data: Obj, toUrl: (key: string) => string): Obj {
  const out: Obj = { ...data };
  for (const f of fields) {
    const v = data[f.key];
    if (f.type === 'image') out[f.key] = typeof v === 'string' && v ? toUrl(v) : '';
    else if (f.type === 'list' && Array.isArray(v)) out[f.key] = v.map((it) => resolveImages(f.fields, it as Obj, toUrl));
  }
  return out;
}

/** Every image key referenced by a section (to detect ones that were dropped). */
export function imageKeys(fields: Field[], data: Obj): string[] {
  const keys: string[] = [];
  for (const f of fields) {
    const v = data[f.key];
    if (f.type === 'image' && typeof v === 'string' && v) keys.push(v);
    else if (f.type === 'list' && Array.isArray(v)) for (const it of v) keys.push(...imageKeys(f.fields, it as Obj));
  }
  return keys;
}
