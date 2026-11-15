import './utils/test-env';
import { buildApp, TestApp, tokenFor } from './utils/build-app';
import { bearer, MEDIA_A, productPayload, Refs, seedRefs } from './utils/catalog-fixtures';

describe('catalog public', () => {
  let t: TestApp;
  let owner: string;
  let refs: Refs;
  const ids: Record<string, string> = {};
  const taxonomy: Record<string, string> = {};

  async function tax(kind: 'brands' | 'families', name: string, extra: object = {}) {
    const key = `${kind}:${name}`;
    taxonomy[key] ??= (await t.http.post(`/api/admin/${kind}`).set(bearer(owner)).send({ name, ...extra }).expect(201)).body.id;
    return taxonomy[key];
  }

  async function make(name: string, o: { brand: string; family: string; gender: string; concentration: string; price: number; sample?: number; stock?: number; over?: object }) {
    const variants: object[] = [{ label: '50 ml', size_ml: 50, price_paise: o.price, stock: o.stock ?? 10 }];
    if (o.sample) variants.unshift({ label: '2 ml sample', size_ml: 2, price_paise: o.sample, is_sample: true, stock: 20 });
    const res = await t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, {
      name, gender: o.gender, concentration: o.concentration, variants, media: [],
      brand_id: await tax('brands', o.brand), family_id: await tax('families', o.family), ...o.over,
    })).expect(201);
    ids[name] = res.body.id;
    return res.body;
  }

  beforeEach(async () => {
    t = await buildApp();
    refs = await seedRefs(t);
    owner = (await tokenFor(t, null)).token;
    for (const k of Object.keys(ids)) delete ids[k];
    for (const k of Object.keys(taxonomy)) delete taxonomy[k];
    // seedRefs already created these two; reuse them instead of creating duplicates.
    taxonomy['brands:SmellMe Originals'] = refs.brandId;
    taxonomy['families:Amber'] = refs.familyId;
    await make('Saffron Dusk', { brand: 'SmellMe Originals', family: 'Amber', gender: 'unisex', concentration: 'edp', price: 285000, sample: 19000, over: { is_featured: true, badge: 'New', media: [{ key: MEDIA_A }] } });
    await make('Jasmine Nuit', { brand: 'Atelier Noor', family: 'Floral', gender: 'women', concentration: 'edp', price: 360000 });
    await make('Oud Ivoire', { brand: 'Maison Aurel', family: 'Oud', gender: 'men', concentration: 'extrait', price: 690000 });
    await make('Citrus Marina', { brand: 'SmellMe Originals', family: 'Fresh', gender: 'men', concentration: 'edt', price: 195000 });
  });
  afterEach(() => t.close());

  const names = (res: { body: { items: { name: string }[] } }) => res.body.items.map((i) => i.name);
  const list = (qs = '') => t.http.get(`/api/products${qs}`);

  describe('listing', () => {
    it('is open to anonymous visitors, unencrypted and cacheable', async () => {
      const res = await list().expect(200);
      expect(res.headers['cache-control']).toMatch(/public, max-age=60/);
      expect(res.body.total).toBe(4);
    });

    it('shapes a card: the full-bottle price (not the sample), size label, image, badge', async () => {
      const card = (await list('?q=saffron').expect(200)).body.items[0];
      expect(card).toMatchObject({
        name: 'Saffron Dusk', slug: 'saffron-dusk', price_paise: 285000, size_label: 'Eau de Parfum · 50 ml',
        has_sample: true, in_stock: true, badge: 'New', concentration_label: 'Eau de Parfum',
        brand: { name: 'SmellMe Originals', is_original: true }, family: { name: 'Amber' }, image: `https://cdn.test/${MEDIA_A}`,
      });
    });

    it('includes the default size so a card can add it to the bag, with availability but no counts', async () => {
      const card = (await list('?q=saffron')).body.items[0];
      expect(card.default_variant).toEqual({ id: expect.stringMatching(/^[0-9a-f-]{36}$/), label: '50 ml', in_stock: true });
      const d = (await t.http.get('/api/products/saffron-dusk')).body;
      expect(d.variants.find((v: any) => v.is_default).id).toBe(card.default_variant.id);
    });

    it('never exposes stock counts, SKUs of hidden sizes, or admin-only fields', async () => {
      const raw = JSON.stringify((await list().expect(200)).body);
      expect(raw).not.toMatch(/"stock"|low_stock_at|sort_order|is_active|admin/);
    });

    it('filters by family, brand, gender, concentration (comma lists = OR)', async () => {
      expect(names(await list('?family=amber'))).toEqual(['Saffron Dusk']);
      expect(names(await list('?family=amber,oud')).sort()).toEqual(['Oud Ivoire', 'Saffron Dusk']);
      expect(names(await list('?brand=smellme-originals')).sort()).toEqual(['Citrus Marina', 'Saffron Dusk']);
      expect(names(await list('?gender=men')).sort()).toEqual(['Citrus Marina', 'Oud Ivoire']);
      expect(names(await list('?concentration=extrait'))).toEqual(['Oud Ivoire']);
      expect(names(await list('?gender=men&brand=smellme-originals'))).toEqual(['Citrus Marina']); // filters AND together
    });

    it('filters by price (paise) using the card price, so a cheap sample does not drag a product in', async () => {
      expect(names(await list('?price_max=200000'))).toEqual(['Citrus Marina']); // Saffron's 19000 sample is ignored
      expect(names(await list('?price_min=300000&price_max=400000'))).toEqual(['Jasmine Nuit']);
      expect((await list('?price_min=10000000')).body.total).toBe(0);
    });

    it('filters to products that have a sample size', async () => {
      expect(names(await list('?sample=true'))).toEqual(['Saffron Dusk']);
    });

    it('searches name, brand, family; treats % and _ literally; survives hostile input', async () => {
      expect(names(await list('?q=noor'))).toEqual(['Jasmine Nuit']);
      expect(names(await list('?q=fresh'))).toEqual(['Citrus Marina']);
      expect((await list('?q=%25')).body.total).toBe(0);
      expect((await list('?q=_')).body.total).toBe(0);
      await list(`?q=${encodeURIComponent("'; DROP TABLE products; --")}`).expect(200);
      expect((await list()).body.total).toBe(4);
    });

    it('sorts: popular (featured first), price low/high, newest', async () => {
      expect(names(await list('?sort=pop'))[0]).toBe('Saffron Dusk');
      expect(names(await list('?sort=low'))).toEqual(['Citrus Marina', 'Saffron Dusk', 'Jasmine Nuit', 'Oud Ivoire']);
      expect(names(await list('?sort=high'))).toEqual(['Oud Ivoire', 'Jasmine Nuit', 'Saffron Dusk', 'Citrus Marina']);
      expect(names(await list('?sort=new'))[0]).toBe('Citrus Marina');
    });

    it('paginates with a stable total', async () => {
      const p1 = (await list('?sort=low&limit=3&page=1')).body;
      const p2 = (await list('?sort=low&limit=3&page=2')).body;
      expect([p1.total, p2.total]).toEqual([4, 4]);
      expect(p1.items).toHaveLength(3);
      expect(p2.items.map((i: any) => i.name)).toEqual(['Oud Ivoire']);
      expect((await list('?limit=3&page=9')).body.items).toEqual([]);
    });

    it.each(['gender=robot', 'concentration=perfume', 'sort=random', 'limit=500', 'limit=0', 'page=0', 'price_min=-5', 'price_min=abc'])(
      '400 for bad query %s', async (qs) => { await list(`?${qs}`).expect(400); });
  });

  describe('default size', () => {
    const sizes = (order: number[]) => order.map((ml, i) => ({
      label: `${ml} ml`, size_ml: ml, is_sample: ml === 2,
      price_paise: { 2: 15000, 10: 79000, 50: 285000, 100: 445000 }[ml]!, stock: 9, sort_order: i,
    }));
    const post = (order: number[]) => t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, { name: 'Order Test', variants: sizes(order), media: [] })).expect(201);

    it('the card, price filter and sort use the FIRST full-size bottle in the size list - not the cheapest', async () => {
      await post([2, 100, 10, 50]); // flagship is the 100 ml; the 10 ml travel spray is cheaper
      const card = (await list('?q=order test')).body.items[0];
      expect(card).toMatchObject({ price_paise: 445000, size_label: 'Eau de Parfum · 100 ml' });
      expect(names(await list('?q=order test&price_max=100000'))).toEqual([]); // 790 is not "its price"
      expect(names(await list('?q=order test&price_min=400000'))).toEqual(['Order Test']);
    });

    it('marks exactly that size as the default on the product page', async () => {
      await post([2, 100, 10, 50]);
      const d = (await t.http.get('/api/products/order-test')).body;
      expect(d.variants.filter((v: any) => v.is_default).map((v: any) => v.size_ml)).toEqual([100]);
    });

    it('reordering the sizes in the admin changes the default', async () => {
      const p = (await post([2, 100, 10, 50])).body;
      const byMl = Object.fromEntries(p.variants.map((v: any) => [v.size_ml, v.id]));
      const reordered = [2, 50, 100, 10].map((ml, i) => ({ id: byMl[ml], label: `${ml} ml`, size_ml: ml, is_sample: ml === 2, price_paise: { 2: 15000, 10: 79000, 50: 285000, 100: 445000 }[ml], sort_order: i }));
      await t.http.put(`/api/admin/products/${p.id}`).set(bearer(owner)).send(productPayload(refs, { name: 'Order Test', variants: reordered, media: [] })).expect(200);
      expect((await list('?q=order test')).body.items[0]).toMatchObject({ price_paise: 285000, size_label: 'Eau de Parfum · 50 ml' });
    });

    it('a samples-only product falls back to its first size', async () => {
      await t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, {
        name: 'Samples Only', media: [], variants: [{ label: '2 ml', size_ml: 2, price_paise: 15000, is_sample: true, stock: 3 }],
      })).expect(201);
      expect((await t.http.get('/api/products/samples-only')).body.variants[0].is_default).toBe(true);
    });
  });

  describe('visibility', () => {
    const admin = (m: 'put' | 'patch', url: string, body: object) => (t.http as any)[m](url).set(bearer(owner)).send(body);

    it('hides inactive products from list and detail', async () => {
      await admin('patch', `/api/admin/products/${ids['Oud Ivoire']}/active`, { is_active: false }).expect(200);
      expect((await list()).body.total).toBe(3);
      await t.http.get('/api/products/oud-ivoire').expect(404);
    });

    it('hides products whose brand or family is switched off', async () => {
      await admin('put', `/api/admin/brands/${taxonomy['brands:Maison Aurel']}`, { name: 'Maison Aurel', is_active: false }).expect(200);
      expect(names(await list())).not.toContain('Oud Ivoire');
      await admin('put', `/api/admin/families/${taxonomy['families:Floral']}`, { name: 'Floral', is_active: false }).expect(200);
      expect(names(await list())).not.toContain('Jasmine Nuit');
      await t.http.get('/api/products/jasmine-nuit').expect(404);
    });

    it('hides a product whose every size has been retired', async () => {
      const p = (await t.http.get(`/api/admin/products/${ids['Citrus Marina']}`).set(bearer(owner))).body;
      await admin('put', `/api/admin/products/${p.id}`, productPayload(refs, {
        name: 'Citrus Marina', brand_id: p.brand_id, family_id: p.family_id, is_active: false,
        variants: p.variants.map((v: any) => ({ id: v.id, label: v.label, size_ml: v.size_ml, price_paise: v.price_paise, is_active: false })),
      })).expect(200);
      expect(names(await list())).not.toContain('Citrus Marina');
    });

    it('shows a samples-only product at its sample price', async () => {
      await t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, {
        name: 'Sample Only', variants: [{ label: '2 ml', size_ml: 2, price_paise: 15000, is_sample: true, stock: 5 }], media: [],
      })).expect(201);
      const card = (await list('?q=sample only')).body.items[0];
      expect(card.price_paise).toBe(15000);
    });
  });

  describe('detail', () => {
    it('returns sizes, grouped notes in tier order, meters with a label, media and related', async () => {
      const d = (await t.http.get('/api/products/saffron-dusk').expect(200)).body;
      expect(d.variants.map((v: any) => [v.label, v.price_paise, v.is_sample])).toEqual([['2 ml sample', 19000, true], ['50 ml', 285000, false]]);
      expect(d.notes.map((n: any) => [n.tier, n.items.map((i: any) => i.name)])).toEqual([['top', ['Saffron']], ['heart', ['Rose']], ['base', ['Vanilla']]]);
      expect(d.media).toEqual([{ url: `https://cdn.test/${MEDIA_A}`, alt: '' }]);
      expect(d.meters).toEqual([]); // labels were not set, so no empty meters
    });

    it('related = same family only, never the product itself, never hidden ones', async () => {
      await make('Amber Two', { brand: 'SmellMe Originals', family: 'Amber', gender: 'unisex', concentration: 'edp', price: 100000 });
      await make('Amber Hidden', { brand: 'SmellMe Originals', family: 'Amber', gender: 'unisex', concentration: 'edp', price: 100000, over: { is_active: false } });
      const d = (await t.http.get('/api/products/saffron-dusk')).body;
      expect(d.related.map((r: any) => r.name)).toEqual(['Amber Two']);
    });

    it('reports availability without numbers: in_stock / low_stock', async () => {
      await make('Last Few', { brand: 'SmellMe Originals', family: 'Amber', gender: 'unisex', concentration: 'edp', price: 1000, stock: 3 });
      await make('Sold Out', { brand: 'SmellMe Originals', family: 'Amber', gender: 'unisex', concentration: 'edp', price: 1000, stock: 0 });
      const few = (await t.http.get('/api/products/last-few')).body;
      expect(few.variants[0]).toMatchObject({ in_stock: true, low_stock: true });
      const out = (await t.http.get('/api/products/sold-out')).body;
      expect(out.variants[0]).toMatchObject({ in_stock: false, low_stock: false });
      expect(out.in_stock).toBe(false);
    });

    it('does not show retired sizes', async () => {
      const p = (await t.http.get(`/api/admin/products/${ids['Saffron Dusk']}`).set(bearer(owner))).body;
      const keep = p.variants.find((v: any) => v.size_ml === 50);
      await t.http.put(`/api/admin/products/${p.id}`).set(bearer(owner)).send(productPayload(refs, {
        name: 'Saffron Dusk', brand_id: p.brand_id, family_id: p.family_id,
        variants: [{ id: keep.id, label: '50 ml', size_ml: 50, price_paise: 285000 }],
      })).expect(200);
      const d = (await t.http.get('/api/products/saffron-dusk')).body;
      expect(d.variants.map((v: any) => v.size_ml)).toEqual([50]);
      expect(d.has_sample).toBe(false);
    });

    it('404 for an unknown slug', async () => { await t.http.get('/api/products/nope').expect(404); });
  });

  describe('filters + taxonomy', () => {
    it('returns counts and the price range of visible products only', async () => {
      const f = (await t.http.get('/api/products/filters').expect(200)).body;
      expect(f.families.map((x: any) => [x.slug, x.count]).sort()).toEqual([['amber', 1], ['floral', 1], ['fresh', 1], ['oud', 1]]);
      expect(f.brands.find((b: any) => b.slug === 'smellme-originals')).toMatchObject({ count: 2, is_original: true });
      expect(f.price_paise).toEqual({ min: 195000, max: 690000 });
      expect(f.concentrations.find((c: any) => c.value === 'extrait').label).toBe('Extrait de Parfum');
    });

    it('public brand/family lists exclude inactive ones', async () => {
      await t.http.put(`/api/admin/brands/${taxonomy['brands:Atelier Noor']}`).set(bearer(owner)).send({ name: 'Atelier Noor', is_active: false });
      expect((await t.http.get('/api/brands').expect(200)).body.map((b: any) => b.name)).not.toContain('Atelier Noor');
      expect((await t.http.get('/api/families').expect(200)).body.length).toBeGreaterThan(0);
    });
  });
});
