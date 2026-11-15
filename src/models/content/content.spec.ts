import { BadRequestException } from '@nestjs/common';
import { CONTENT_PAGES } from './content.pages';
import type { SectionSpec } from './content.types';
import { imageKeys, mergeDefaults, resolveImages, validateSection } from './content.validate';

const KEY = 'media/0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab.webp';
const all = CONTENT_PAGES.flatMap((p) => p.sections.map((s) => [`${p.key}.${s.key}`, s] as const));

describe('content specs', () => {
  it('have unique page and section keys', () => {
    expect(new Set(CONTENT_PAGES.map((p) => p.key)).size).toBe(CONTENT_PAGES.length);
    for (const p of CONTENT_PAGES) expect(new Set(p.sections.map((s) => s.key)).size).toBe(p.sections.length);
  });

  it.each(all)('%s: the built-in defaults pass its own validation (so an untouched Save works)', (_n, spec) => {
    expect(() => validateSection(spec, spec.defaults)).not.toThrow();
  });

  it.each(all)('%s: defaults only contain fields the spec defines', (_n, spec) => {
    for (const k of Object.keys(spec.defaults)) expect(spec.fields.map((f) => f.key)).toContain(k);
  });

  it.each(all)('%s: every field has a defined default', (_n, spec) => {
    for (const f of spec.fields) expect(spec.defaults).toHaveProperty(f.key);
  });

  it('never ships bracketed placeholders like [N] or [WhatsApp number] as visible text', () => {
    const text = JSON.stringify(CONTENT_PAGES.map((p) => p.sections.map((s) => s.defaults)));
    expect(text).not.toMatch(/\[[A-Za-z][^\]]{0,40}\]/);
  });

  it('does not promise cash on delivery anywhere', () => {
    const questions = JSON.stringify(CONTENT_PAGES.flatMap((p) => p.sections.map((s) => s.defaults)));
    expect(questions).not.toMatch(/Yes, on serviceable pincodes|Cash on delivery across/i);
  });
});

describe('validateSection', () => {
  const spec: SectionSpec = {
    key: 's', title: 'S', defaults: {},
    fields: [
      { type: 'text', key: 'title', label: 'T', max: 10, required: true },
      { type: 'textarea', key: 'body', label: 'B', max: 20 },
      { type: 'image', key: 'pic', label: 'P' },
      { type: 'list', key: 'items', label: 'I', itemLabel: 'item', max: 2, fields: [
        { type: 'text', key: 'name', label: 'N', required: true },
        { type: 'image', key: 'img', label: 'Im' },
      ] },
    ],
  };
  const err = (data: unknown) => { try { validateSection(spec, data); } catch (e) { return (e as BadRequestException).message; } return null; };

  it('trims, fills missing fields, and returns exactly the spec fields', () => {
    expect(validateSection(spec, { title: '  Hi  ' })).toEqual({ title: 'Hi', body: '', pic: '', items: [] });
  });

  it('requires required text, with the path in the message', () => {
    expect(err({ title: '   ' })).toBe('title: is required');
    expect(err({ title: 'x', items: [{ name: '' }] })).toBe('items[1].name: is required');
  });

  it('enforces max lengths and list sizes', () => {
    expect(err({ title: 'x'.repeat(11) })).toMatch(/at most 10/);
    expect(err({ title: 'x', body: 'y'.repeat(21) })).toMatch(/at most 20/);
    expect(err({ title: 'x', items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] })).toMatch(/at most 2 entries/);
  });

  it('rejects unknown fields, at the top level and inside list items', () => {
    expect(err({ title: 'x', evil: 1 })).toBe('evil: is not an editable field');
    expect(err({ title: 'x', items: [{ name: 'a', evil: 1 }] })).toMatch(/items\[1\]\.evil/);
  });

  it('rejects wrong types', () => {
    expect(err({ title: 5 })).toMatch(/must be text/);
    expect(err({ title: 'x', items: 'nope' })).toMatch(/must be a list/);
    expect(err('nope')).toMatch(/must be an object/);
    expect(err(null)).toMatch(/must be an object/);
    expect(err([])).toMatch(/must be an object/);
  });

  it('refuses angle brackets so markup can never be stored', () => {
    expect(err({ title: '<b>x</b>' })).toMatch(/cannot contain/);
    expect(err({ title: 'x', body: '<img src=x>' })).toMatch(/cannot contain/);
  });

  it('only accepts uploaded-media keys for image fields', () => {
    expect(err({ title: 'x', pic: KEY })).toBeNull();
    for (const bad of ['https://evil.com/x.png', '../../etc/passwd', 'media/x.svg', 'javascript:alert(1)']) {
      expect(err({ title: 'x', pic: bad })).toMatch(/not a valid uploaded image/);
    }
    expect(err({ title: 'x', items: [{ name: 'a', img: 'http://x' }] })).toMatch(/items\[1\]\.img/);
  });
});

describe('mergeDefaults / resolveImages / imageKeys', () => {
  const spec: SectionSpec = {
    key: 's', title: 'S', defaults: { a: 'default a', b: 'default b', pic: '', items: [{ img: '' }] },
    fields: [
      { type: 'text', key: 'a', label: 'A' }, { type: 'text', key: 'b', label: 'B' }, { type: 'image', key: 'pic', label: 'P' },
      { type: 'list', key: 'items', label: 'I', itemLabel: 'i', max: 5, fields: [{ type: 'image', key: 'img', label: 'I' }] },
    ],
  };

  it('prefers saved values, falls back per field, and treats an explicitly emptied field as saved', () => {
    expect(mergeDefaults(spec, null).a).toBe('default a');
    expect(mergeDefaults(spec, { a: 'mine' })).toMatchObject({ a: 'mine', b: 'default b' });
    expect(mergeDefaults(spec, { a: '' }).a).toBe(''); // owner cleared it on purpose: do not resurrect the default
  });

  it('ignores stored keys that are no longer in the spec', () => {
    expect(mergeDefaults(spec, { removed: 'x' })).not.toHaveProperty('removed');
  });

  it('turns image keys into URLs, including inside lists, and leaves empty ones empty', () => {
    const out = resolveImages(spec.fields, { pic: KEY, items: [{ img: KEY }, { img: '' }] }, (k) => `https://cdn/${k}`);
    expect(out).toEqual({ pic: `https://cdn/${KEY}`, items: [{ img: `https://cdn/${KEY}` }, { img: '' }] });
  });

  it('lists every referenced image key', () => {
    expect(imageKeys(spec.fields, { pic: KEY, items: [{ img: KEY.replace('0b9c', 'aaaa') }, { img: '' }] })).toHaveLength(2);
  });
});
