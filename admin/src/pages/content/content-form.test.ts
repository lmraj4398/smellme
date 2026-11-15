import type { Field } from '@/api/content.api';
import { emptyItem, isDirty, setIn, splitEmphasis, validateDraft } from './content-form';

const KEY = 'media/0b9c1f8e-1a2b-4c3d-8e9f-0123456789ab.webp';
const fields: Field[] = [
  { type: 'text', key: 'title', label: 'T', max: 10, required: true },
  { type: 'textarea', key: 'body', label: 'B' },
  { type: 'image', key: 'pic', label: 'P' },
  { type: 'list', key: 'items', label: 'I', itemLabel: 'item', max: 2, fields: [
    { type: 'text', key: 'name', label: 'N', required: true },
    { type: 'list', key: 'subs', label: 'S', itemLabel: 'sub', max: 3, fields: [{ type: 'text', key: 'q', label: 'Q', required: true }] },
  ] },
];

describe('validateDraft', () => {
  const ok = { title: 'Hi', body: '', pic: '', items: [] };
  it('accepts a valid draft', () => expect(validateDraft(fields, ok)).toEqual({}));
  it('requires required text', () => expect(validateDraft(fields, { ...ok, title: '  ' }).title).toBe('Required'));
  it('enforces max length (spec max, else 200 for text / 2000 for textarea)', () => {
    expect(validateDraft(fields, { ...ok, title: 'x'.repeat(11) }).title).toMatch(/At most 10/);
    expect(validateDraft(fields, { ...ok, body: 'x'.repeat(2001) }).body).toMatch(/At most 2000/);
    expect(validateDraft(fields, { ...ok, body: 'x'.repeat(2000) }).body).toBeUndefined();
  });
  it('rejects angle brackets', () => expect(validateDraft(fields, { ...ok, body: '<b>' }).body).toMatch(/Cannot contain/));
  it('checks image keys', () => {
    expect(validateDraft(fields, { ...ok, pic: KEY })).toEqual({});
    expect(validateDraft(fields, { ...ok, pic: 'https://x.com/a.png' }).pic).toBeTruthy();
  });
  it('limits list sizes', () => {
    const items = [{ name: 'a', subs: [] }, { name: 'b', subs: [] }, { name: 'c', subs: [] }];
    expect(validateDraft(fields, { ...ok, items }).items).toMatch(/At most 2 items/);
  });
  it('reports errors at the exact nested path', () => {
    const e = validateDraft(fields, { ...ok, items: [{ name: 'a', subs: [] }, { name: '', subs: [{ q: '' }] }] });
    expect(e['items.1.name']).toBe('Required');
    expect(e['items.1.subs.0.q']).toBe('Required');
    expect(Object.keys(e)).toHaveLength(2);
  });
});

describe('emptyItem', () => {
  it('blanks text and starts nested lists empty', () => {
    expect(emptyItem((fields[3] as any).fields)).toEqual({ name: '', subs: [] });
  });
});

describe('setIn', () => {
  const root = { a: [{ x: 1 }, { x: 2 }], b: 'k' };
  it('sets deep without mutating', () => {
    const out = setIn(root, ['a', 1, 'x'], 9);
    expect(out).toEqual({ a: [{ x: 1 }, { x: 9 }], b: 'k' });
    expect(root.a[1].x).toBe(2);
    expect(out.a[0]).toBe(root.a[0]); // untouched branches are shared
  });
});

describe('misc', () => {
  it('isDirty compares by value', () => {
    expect(isDirty({ a: 1 }, { a: 1 })).toBe(false);
    expect(isDirty({ a: 1 }, { a: 2 })).toBe(true);
  });
  it('splitEmphasis marks *words*', () => {
    expect(splitEmphasis('Find the scent that *stays* with you.')).toEqual([
      { text: 'Find the scent that ', em: false }, { text: 'stays', em: true }, { text: ' with you.', em: false },
    ]);
    expect(splitEmphasis('plain')).toEqual([{ text: 'plain', em: false }]);
    expect(splitEmphasis('a *b')).toEqual([{ text: 'a ', em: false }, { text: '*b', em: false }]);
  });
});
