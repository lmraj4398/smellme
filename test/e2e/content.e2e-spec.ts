import './utils/test-env';
import { buildApp, TestApp, tokenFor } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';

const KEY_A = 'media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
const KEY_B = 'media/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp';

describe('site content', () => {
  let t: TestApp;
  let owner: string;
  beforeEach(async () => {
    t = await buildApp();
    owner = (await tokenFor(t, null)).token;
  });
  afterEach(() => t.close());

  const pub = (page: string) => t.http.get(`/api/content/${page}`);
  const put = (page: string, section: string, data: object, token = owner) => t.http.put(`/api/admin/content/${page}/${section}`).set(bearer(token)).send({ data });
  const heroOf = async () => (await t.http.get('/api/admin/content/home').set(bearer(owner)).expect(200)).body.sections.find((s: any) => s.key === 'hero');

  describe('public', () => {
    it('works with no edits at all: serves the built-in defaults, unencrypted and cacheable', async () => {
      const res = await pub('home').expect(200);
      expect(res.headers['cache-control']).toMatch(/public, max-age=60/);
      expect(res.body.sections.hero.headline).toBe('Find the scent that *stays* with you.');
      expect(res.body.sections.trust.items).toHaveLength(4);
      expect(Object.keys(res.body.sections)).toEqual(expect.arrayContaining(['hero', 'trust', 'originals', 'newsletter']));
    });

    it('serves every page', async () => {
      for (const p of ['home', 'gifting', 'about', 'help', 'site']) await pub(p).expect(200);
    });

    it('404 for an unknown page', async () => {
      await pub('admin').expect(404);
      await pub('constructor').expect(404);
      await pub('..%2Fetc').expect(404);
    });

    it('needs no login and reveals nothing about who edited what', async () => {
      await put('home', 'hero', { headline: 'Edited' }).expect(200);
      const raw = JSON.stringify((await pub('home')).body);
      expect(raw).not.toMatch(/updated_by|updated_at|customised/);
    });
  });

  describe('editing', () => {
    it('saves a section and the public page reflects it; other sections keep their defaults', async () => {
      await put('home', 'hero', { eyebrow: 'New eyebrow', headline: 'Your *scent* story', body: 'Hello', primary_label: 'Go', secondary_label: 'Quiz' }).expect(200);
      const home = (await pub('home')).body.sections;
      expect(home.hero).toMatchObject({ eyebrow: 'New eyebrow', headline: 'Your *scent* story', body: 'Hello' });
      expect(home.trust.items).toHaveLength(4); // untouched
    });

    it('a field left out of a save falls back to its default; a field emptied on purpose stays empty', async () => {
      await put('home', 'hero', { headline: 'Only this', body: '' }).expect(200);
      const hero = (await pub('home')).body.sections.hero;
      expect(hero.body).toBe('');
      // eyebrow was never sent => validated as '' and stored (saves are whole-section), i.e. also emptied.
      expect(hero.eyebrow).toBe('');
    });

    it('reports which sections are customised in the admin view', async () => {
      expect((await heroOf()).customised).toBe(false);
      await put('home', 'hero', { headline: 'X' }).expect(200);
      const hero = await heroOf();
      expect(hero.customised).toBe(true);
      expect(hero.updated_at).toBeTruthy();
    });

    it('saving the defaults unchanged works (first Save of an untouched form)', async () => {
      const hero = await heroOf();
      await put('home', 'hero', hero.data).expect(200);
      const trust = (await t.http.get('/api/admin/content/home').set(bearer(owner))).body.sections.find((s: any) => s.key === 'trust');
      await put('home', 'trust', trust.data).expect(200);
    });

    it('reset puts the defaults back', async () => {
      await put('home', 'hero', { headline: 'Edited' }).expect(200);
      const r = await t.http.delete('/api/admin/content/home/hero').set(bearer(owner)).expect(200);
      expect(r.body.customised).toBe(false);
      expect((await pub('home')).body.sections.hero.headline).toBe('Find the scent that *stays* with you.');
    });

    it('saves lists (add / reorder / remove) wholesale', async () => {
      await put('home', 'moments', { eyebrow: 'e', heading: 'h', items: [{ label: 'B', sub: '' }, { label: 'A', sub: 's' }] }).expect(200);
      expect((await pub('home')).body.sections.moments.items.map((i: any) => i.label)).toEqual(['B', 'A']);
      await put('home', 'moments', { eyebrow: 'e', heading: 'h', items: [] }).expect(200);
      expect((await pub('home')).body.sections.moments.items).toEqual([]);
    });

    it('saves nested lists (FAQ topics with questions)', async () => {
      await put('help', 'faq', { categories: [{ name: 'Shipping', faqs: [{ q: 'How long?', a: '3 days' }] }] }).expect(200);
      expect((await pub('help')).body.sections.faq.categories[0].faqs[0]).toEqual({ q: 'How long?', a: '3 days' });
    });

    it('turns image keys into CDN URLs on the public page but keeps keys in the editor', async () => {
      await put('home', 'originals', { eyebrow: '', heading: 'h', body: '', image_1: KEY_A, image_2: '', stats: [], cta_label: '' }).expect(200);
      expect((await pub('home')).body.sections.originals.image_1).toBe(`https://cdn.test/${KEY_A}`);
      const admin = (await t.http.get('/api/admin/content/home').set(bearer(owner))).body.sections.find((s: any) => s.key === 'originals');
      expect(admin.data.image_1).toBe(KEY_A);
    });

    it('deletes images that were removed or replaced, but not ones still in use', async () => {
      const base = { eyebrow: '', heading: 'h', body: '', image_2: '', stats: [], cta_label: '' };
      await put('home', 'originals', { ...base, image_1: KEY_A }).expect(200);
      await put('home', 'originals', { ...base, image_1: KEY_B }).expect(200);
      expect(t.storage.deleted).toEqual([KEY_A]);
      await put('home', 'originals', { ...base, image_1: KEY_B, heading: 'again' }).expect(200);
      expect(t.storage.deleted).toEqual([KEY_A]); // KEY_B still used
      await t.http.delete('/api/admin/content/home/originals').set(bearer(owner)).expect(200);
      expect(t.storage.deleted).toEqual([KEY_A, KEY_B]);
    });
  });

  describe('validation (400) leaves stored content untouched', () => {
    it.each([
      ['unknown field', 'hero', { headline: 'x', evil: 1 }, /not an editable field/],
      ['markup', 'hero', { headline: '<script>alert(1)</script>' }, /cannot contain/],
      ['required text empty', 'hero', { headline: '  ' }, /headline: is required/],
      ['text too long', 'hero', { headline: 'x'.repeat(121) }, /at most 120/],
      ['too many list entries', 'trust', { items: Array.from({ length: 5 }, () => ({ title: 't', sub: '' })) }, /at most 4/],
      ['required field inside a list', 'trust', { items: [{ title: '', sub: '' }] }, /items\[1\]\.title: is required/],
      ['remote image URL', 'originals', { image_1: 'https://evil.com/x.png' }, /not a valid uploaded image/],
      ['image path traversal', 'originals', { image_1: '../../etc/passwd' }, /not a valid uploaded image/],
    ])('%s', async (_n, section, data, msg) => {
      await put('home', 'hero', { headline: 'Original' }).expect(200);
      const res = await put('home', section, data as object).expect(400);
      expect(res.body.message).toMatch(msg);
      expect((await pub('home')).body.sections.hero.headline).toBe('Original');
    });

    it('400 for a missing or non-object data body', async () => {
      await t.http.put('/api/admin/content/home/hero').set(bearer(owner)).send({}).expect(400);
      await t.http.put('/api/admin/content/home/hero').set(bearer(owner)).send({ data: 'x' }).expect(400);
    });

    it('404 for an unknown page or section', async () => {
      await put('nope', 'hero', {}).expect(404);
      await put('home', 'nope', {}).expect(404);
      await t.http.delete('/api/admin/content/home/nope').set(bearer(owner)).expect(404);
      await t.http.get('/api/admin/content/nope').set(bearer(owner)).expect(404);
    });
  });

  describe('access control', () => {
    it('401 without a token', async () => {
      await t.http.get('/api/admin/content/schema').expect(401);
      await t.http.get('/api/admin/content/home').expect(401);
      await t.http.put('/api/admin/content/home/hero').send({ data: {} }).expect(401);
      await t.http.delete('/api/admin/content/home/hero').expect(401);
    });

    it('403 for a login without the "content" screen, and nothing is changed', async () => {
      const { token } = await tokenFor(t, ['products', 'orders']);
      await t.http.get('/api/admin/content/schema').set(bearer(token)).expect(403);
      await t.http.get('/api/admin/content/home').set(bearer(token)).expect(403);
      await put('home', 'hero', { headline: 'Hacked' }, token).expect(403);
      await t.http.delete('/api/admin/content/home/hero').set(bearer(token)).expect(403);
      expect((await pub('home')).body.sections.hero.headline).toBe('Find the scent that *stays* with you.');
    });

    it('a login limited to just "content" can edit it', async () => {
      const { token } = await tokenFor(t, ['content']);
      await put('home', 'hero', { headline: 'Editor was here' }, token).expect(200);
    });

    it('the schema describes every editable field and does not leak defaults', async () => {
      const s = (await t.http.get('/api/admin/content/schema').set(bearer(owner)).expect(200)).body;
      expect(s.media_base).toBe('https://cdn.test');
      expect(s.pages.map((p: any) => p.key)).toEqual(['home', 'gifting', 'about', 'help', 'site']);
      const hero = s.pages[0].sections.find((x: any) => x.key === 'hero');
      expect(hero.fields.map((f: any) => f.key)).toContain('headline');
      expect(hero).not.toHaveProperty('defaults');
    });
  });
});
