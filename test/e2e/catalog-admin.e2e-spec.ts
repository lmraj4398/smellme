import './utils/test-env';
import { buildApp, TestApp, tokenFor } from './utils/build-app';
import { bearer, createProduct, MEDIA_A, MEDIA_B, productPayload, Refs, seedRefs } from './utils/catalog-fixtures';

describe('catalog admin', () => {
  let t: TestApp;
  let refs: Refs;
  let owner: string;

  beforeEach(async () => {
    t = await buildApp();
    refs = await seedRefs(t);
    owner = (await tokenFor(t, null)).token;
  });
  afterEach(() => t.close());

  // ── access control ────────────────────────────────────────────────────────
  describe('access control', () => {
    const routes: [string, string][] = [
      ['get', '/api/admin/products'],
      ['get', '/api/admin/brands'],
      ['get', '/api/admin/families'],
      ['get', '/api/admin/notes'],
      ['get', '/api/admin/inventory'],
      ['post', '/api/admin/uploads/presign'],
      ['get', '/api/admin/logins'],
    ];

    it.each(routes)('401 without a token: %s %s', async (m, url) => {
      await (t.http as any)[m](url).expect(401);
    });

    it('a login limited to OTHER screens is refused (403) on products, taxonomy and inventory', async () => {
      const { token } = await tokenFor(t, ['orders']);
      for (const url of ['/api/admin/products', '/api/admin/brands', '/api/admin/families', '/api/admin/notes', '/api/admin/inventory']) {
        await t.http.get(url).set(bearer(token)).expect(403);
      }
      await t.http.post('/api/admin/brands').set(bearer(token)).send({ name: 'X' }).expect(403);
    });

    it('"products" opens products + taxonomy but not inventory; "inventory" the reverse', async () => {
      const p = (await tokenFor(t, ['products'])).token;
      await t.http.get('/api/admin/products').set(bearer(p)).expect(200);
      await t.http.get('/api/admin/brands').set(bearer(p)).expect(200);
      await t.http.get('/api/admin/inventory').set(bearer(p)).expect(403);

      const i = (await tokenFor(t, ['inventory'])).token;
      await t.http.get('/api/admin/inventory').set(bearer(i)).expect(200);
      await t.http.get('/api/admin/products').set(bearer(i)).expect(403);
    });

    it('a restricted login cannot write products either', async () => {
      const { token } = await tokenFor(t, ['content']);
      await t.http.post('/api/admin/products').set(bearer(token)).send(productPayload(refs)).expect(403);
    });

    it('image presign needs a login but no particular screen', async () => {
      const { token } = await tokenFor(t, ['orders']);
      await t.http.post('/api/admin/uploads/presign').set(bearer(token)).send({ content_type: 'image/png', size: 1000 }).expect(200);
    });
  });

  // ── taxonomy ──────────────────────────────────────────────────────────────
  describe('taxonomy', () => {
    it('creates a brand with an auto slug and rejects a duplicate name', async () => {
      const r = await t.http.post('/api/admin/brands').set(bearer(owner)).send({ name: 'Kasturi & Co.' }).expect(201);
      expect(r.body.slug).toBe('kasturi-and-co');
      const dup = await t.http.post('/api/admin/brands').set(bearer(owner)).send({ name: 'Kasturi & Co.' }).expect(409);
      expect(dup.body.message).toMatch(/already exists/);
    });

    it('validates colours and unknown fields', async () => {
      await t.http.post('/api/admin/families').set(bearer(owner)).send({ name: 'Oud', tint: 'red' }).expect(400);
      await t.http.post('/api/admin/families').set(bearer(owner)).send({ name: 'Oud', tint: '#ECE2D6', evil: 1 }).expect(400);
      await t.http.post('/api/admin/families').set(bearer(owner)).send({ name: 'Oud', tint: '#ECE2D6' }).expect(201);
    });

    it('updates, 404s on unknown ids, and 400s on malformed ids', async () => {
      const b = (await t.http.post('/api/admin/brands').set(bearer(owner)).send({ name: 'Maison Aurel' }).expect(201)).body;
      const up = await t.http.put(`/api/admin/brands/${b.id}`).set(bearer(owner)).send({ name: 'Maison Aurel', is_active: false }).expect(200);
      expect(up.body.is_active).toBe(false);
      await t.http.put('/api/admin/brands/11111111-1111-4111-8111-111111111111').set(bearer(owner)).send({ name: 'Z' }).expect(404);
      await t.http.put('/api/admin/brands/not-a-uuid').set(bearer(owner)).send({ name: 'Z' }).expect(400);
    });

    it('refuses to delete a brand/family/note that products use (409) but deletes unused ones', async () => {
      await createProduct(t, owner, productPayload(refs));
      await t.http.delete(`/api/admin/brands/${refs.brandId}`).set(bearer(owner)).expect(409);
      await t.http.delete(`/api/admin/families/${refs.familyId}`).set(bearer(owner)).expect(409);
      await t.http.delete(`/api/admin/notes/${refs.noteIds[0]}`).set(bearer(owner)).expect(409);

      const spare = (await t.http.post('/api/admin/brands').set(bearer(owner)).send({ name: 'Spare' }).expect(201)).body;
      await t.http.delete(`/api/admin/brands/${spare.id}`).set(bearer(owner)).expect(200);
      await t.http.delete(`/api/admin/brands/${spare.id}`).set(bearer(owner)).expect(404);
    });
  });

  // ── product create ────────────────────────────────────────────────────────
  describe('create product', () => {
    it('saves product, sizes, notes and media; derives slug and SKUs; records opening stock in the ledger', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      expect(p.slug).toBe('saffron-dusk');
      expect(p.variants.map((v) => v.sku).sort()).toEqual(['saffron-dusk-2ml', 'saffron-dusk-50ml']);
      expect(p.variants.find((v) => v.size_ml === 50)!.stock).toBe(10);

      const ledger = await t.db.query('SELECT delta, balance_after, reason, admin_id FROM stock_ledger ORDER BY delta');
      expect(ledger.map((l: any) => [l.delta, l.balance_after, l.reason])).toEqual([[10, 10, 'opening'], [40, 40, 'opening']]);
      expect(ledger.every((l: any) => l.admin_id)).toBe(true);
    });

    it('gives a second product with the same name a unique slug', async () => {
      await createProduct(t, owner, productPayload(refs));
      const b = await createProduct(t, owner, productPayload(refs));
      expect(b.slug).toBe('saffron-dusk-2');
    });

    it('returns media with its public URL', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      const got = (await t.http.get(`/api/admin/products/${p.id}`).set(bearer(owner)).expect(200)).body;
      expect(got.media[0].url).toBe(`https://cdn.test/${MEDIA_A}`);
    });

    it.each([
      ['unknown brand', { brand_id: '11111111-1111-4111-8111-111111111111' }, /brand/i],
      ['unknown family', { family_id: '11111111-1111-4111-8111-111111111111' }, /family/i],
      ['bad concentration', { concentration: 'perfume-ish' }, /concentration/i],
      ['bad gender', { gender: 'robot' }, /gender/i],
      ['bad colour', { tint: 'beige' }, /hex/i],
      ['level out of range', { longevity_level: 9 }, /longevity_level/i],
      ['arbitrary media key', { media: [{ key: '../../etc/passwd' }] }, /media key/i],
      ['svg media key', { media: [{ key: 'media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.svg' }] }, /media key/i],
      ['duplicate media', { media: [{ key: MEDIA_A }, { key: MEDIA_A }] }, /duplicate image/i],
      ['active but no sizes', { variants: [] }, /at least one active size/i],
      ['negative price', { variants: [{ label: 'x', size_ml: 50, price_paise: -1 }] }, /price_paise/i],
      ['fractional price', { variants: [{ label: 'x', size_ml: 50, price_paise: 99.5 }] }, /price_paise/i],
      ['unknown field', { owner_id: 'x' }, /should not exist/i],
    ])('400: %s', async (_n, over, msg) => {
      const res = await t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, over)).expect(400);
      expect(res.body.message).toMatch(msg);
    });

    it('400 on duplicate SKU in one payload; 409 on a SKU already used by another product', async () => {
      const v = (sku: string) => ({ label: 'a', size_ml: 50, price_paise: 100, sku });
      await t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, { variants: [v('X1'), { ...v('X1'), size_ml: 100 }] })).expect(400);
      await createProduct(t, owner, productPayload(refs, { name: 'A', variants: [v('SHARED')] }));
      await t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, { name: 'B', variants: [v('SHARED')] })).expect(409);
    });

    it('rolls back everything when part of the save fails (no half-created product)', async () => {
      const bad = productPayload(refs, { name: 'Ghost', notes: [{ note_id: '11111111-1111-4111-8111-111111111111', tier: 'top' }] });
      await t.http.post('/api/admin/products').set(bearer(owner)).send(bad).expect(400);
      expect(await t.db.query("SELECT 1 FROM products WHERE name = 'Ghost'")).toHaveLength(0);
      expect(await t.db.query('SELECT 1 FROM stock_ledger')).toHaveLength(0);
    });
  });

  // ── product update ────────────────────────────────────────────────────────
  describe('update product', () => {
    const put = (id: string, body: object) => t.http.put(`/api/admin/products/${id}`).set(bearer(owner)).send(body);

    it('updates fields and a size in place; stock in the payload is ignored for existing sizes', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      const v50 = p.variants.find((v) => v.size_ml === 50)!;
      const res = await put(p.id, productPayload(refs, {
        name: 'Saffron Dusk Intense',
        variants: [{ id: v50.id, label: '50 ml', size_ml: 50, price_paise: 299000, stock: 9999 }, { id: p.variants.find((v) => v.size_ml === 2)!.id, label: '2 ml sample', size_ml: 2, price_paise: 19000, is_sample: true }],
      })).expect(200);
      expect(res.body.name).toBe('Saffron Dusk Intense');
      expect(res.body.slug).toBe('saffron-dusk'); // slug is stable unless explicitly changed
      const after = res.body.variants.find((v: any) => v.id === v50.id);
      expect(after.price_paise).toBe(299000);
      expect(after.stock).toBe(10); // unchanged: stock moves only via /admin/inventory
    });

    it('rejects a size id that belongs to ANOTHER product (400) and changes nothing', async () => {
      const a = await createProduct(t, owner, productPayload(refs, { name: 'A' }));
      const b = await createProduct(t, owner, productPayload(refs, { name: 'B' }));
      const foreign = b.variants[0];
      await put(a.id, productPayload(refs, { name: 'A', variants: [{ id: foreign.id, label: 'hijack', size_ml: 1, price_paise: 1 }] })).expect(400);
      const row = await t.db.query('SELECT label, price_paise, product_id FROM product_variants WHERE id = $1', [foreign.id]);
      expect(row[0].label).not.toBe('hijack');
      expect(row[0].product_id).toBe(b.id);
    });

    it('retires (never deletes) sizes that are left out', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      const keep = p.variants.find((v) => v.size_ml === 50)!;
      await put(p.id, productPayload(refs, { variants: [{ id: keep.id, label: '50 ml', size_ml: 50, price_paise: 285000 }] })).expect(200);
      const rows = await t.db.query('SELECT size_ml, is_active FROM product_variants WHERE product_id = $1 ORDER BY size_ml', [p.id]);
      expect(rows.map((r: any) => [r.size_ml, r.is_active])).toEqual([[2, false], [50, true]]);
    });

    it('adds a new size with opening stock', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      const res = await put(p.id, productPayload(refs, {
        variants: [...p.variants.map((v) => ({ id: v.id, label: `${v.size_ml} ml`, size_ml: v.size_ml, price_paise: 1000 })), { label: '100 ml', size_ml: 100, price_paise: 445000, stock: 7 }],
      })).expect(200);
      expect(res.body.variants.find((v: any) => v.size_ml === 100).stock).toBe(7);
    });

    it('replaces notes and media, and deletes dropped images from storage after commit', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      await put(p.id, productPayload(refs, {
        variants: p.variants.map((v) => ({ id: v.id, label: 'x', size_ml: v.size_ml, price_paise: 100 })),
        notes: [{ note_id: refs.noteIds[2], tier: 'base' }],
        media: [{ key: MEDIA_B }],
      })).expect(200);
      const got = (await t.http.get(`/api/admin/products/${p.id}`).set(bearer(owner))).body;
      expect(got.notes).toHaveLength(1);
      expect(got.media.map((m: any) => m.key)).toEqual([MEDIA_B]);
      expect(t.storage.deleted).toEqual([MEDIA_A]);
    });

    it('does not delete images when the update fails', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      await put(p.id, productPayload(refs, { media: [{ key: MEDIA_B }], brand_id: '11111111-1111-4111-8111-111111111111' })).expect(400);
      expect(t.storage.deleted).toEqual([]);
      expect((await t.http.get(`/api/admin/products/${p.id}`).set(bearer(owner))).body.media[0].key).toBe(MEDIA_A);
    });

    it('404 for an unknown product, 400 for a malformed id', async () => {
      await put('11111111-1111-4111-8111-111111111111', productPayload(refs)).expect(404);
      await put('nope', productPayload(refs)).expect(400);
    });

    it('can switch a product off and on', async () => {
      const p = await createProduct(t, owner, productPayload(refs));
      const off = await t.http.patch(`/api/admin/products/${p.id}/active`).set(bearer(owner)).send({ is_active: false }).expect(200);
      expect(off.body.is_active).toBe(false);
      const list = (await t.http.get('/api/admin/products?active=false').set(bearer(owner)).expect(200)).body;
      expect(list.items.map((i: any) => i.id)).toEqual([p.id]);
    });
  });

  // ── admin list ────────────────────────────────────────────────────────────
  it('lists products with search, price and stock summaries (inactive sizes excluded)', async () => {
    await createProduct(t, owner, productPayload(refs, { name: 'Alpha' }));
    await createProduct(t, owner, productPayload(refs, { name: 'Beta' }));
    const all = (await t.http.get('/api/admin/products').set(bearer(owner)).expect(200)).body;
    expect(all.total).toBe(2);
    expect(all.items[0]).toMatchObject({ variant_count: 2, min_price_paise: 19000, total_stock: 50 });
    const q = (await t.http.get('/api/admin/products?q=alp').set(bearer(owner))).body;
    expect(q.items.map((i: any) => i.name)).toEqual(['Alpha']);
    await t.http.get('/api/admin/products?limit=1000').set(bearer(owner)).expect(400);
  });

  // ── inventory ─────────────────────────────────────────────────────────────
  describe('inventory', () => {
    let variantId: string;
    beforeEach(async () => {
      const p = await createProduct(t, owner, productPayload(refs, { variants: [{ label: '50 ml', size_ml: 50, price_paise: 100000, stock: 5, low_stock_at: 3 }] }));
      variantId = p.variants[0].id;
    });
    const adjust = (id: string, body: object, token = owner) => t.http.post(`/api/admin/inventory/${id}/adjust`).set(bearer(token)).send(body);

    it('adds and removes stock and writes an append-only ledger row each time', async () => {
      expect((await adjust(variantId, { delta: 20, reason: 'purchase', note: 'PO-17' }).expect(200)).body.stock).toBe(25);
      expect((await adjust(variantId, { delta: -2, reason: 'damage' }).expect(200)).body.stock).toBe(23);
      const hist = (await t.http.get(`/api/admin/inventory/${variantId}/ledger`).set(bearer(owner)).expect(200)).body;
      expect(hist.items.map((i: any) => [i.delta, i.balance_after, i.reason])).toEqual([[-2, 23, 'damage'], [20, 25, 'purchase'], [5, 5, 'opening']]);
    });

    it('refuses to go below zero (409) and leaves stock and ledger untouched', async () => {
      await adjust(variantId, { delta: -6, reason: 'adjustment' }).expect(409);
      expect((await t.db.query('SELECT stock FROM product_variants WHERE id = $1', [variantId]))[0].stock).toBe(5);
      expect(await t.db.query('SELECT 1 FROM stock_ledger WHERE variant_id = $1', [variantId])).toHaveLength(1);
    });

    it('rejects zero, fractions, system-only reasons and unknown variants', async () => {
      await adjust(variantId, { delta: 0, reason: 'adjustment' }).expect(400);
      await adjust(variantId, { delta: 1.5, reason: 'adjustment' }).expect(400);
      await adjust(variantId, { delta: -1, reason: 'sale' }).expect(400); // sales are made by orders only
      await adjust(variantId, { delta: 1, reason: 'opening' }).expect(400);
      await adjust('11111111-1111-4111-8111-111111111111', { delta: 1, reason: 'purchase' }).expect(404);
    });

    it('is safe under concurrency: 12 parallel removals against 5 units succeed exactly 5 times', async () => {
      const results = await Promise.all(Array.from({ length: 12 }, () => adjust(variantId, { delta: -1, reason: 'adjustment' })));
      expect(results.filter((r) => r.status === 200)).toHaveLength(5);
      expect(results.filter((r) => r.status === 409)).toHaveLength(7);
      expect((await t.db.query('SELECT stock FROM product_variants WHERE id = $1', [variantId]))[0].stock).toBe(0);
      const rows = await t.db.query('SELECT balance_after FROM stock_ledger WHERE variant_id = $1 AND reason = $2', [variantId, 'adjustment']);
      expect(rows.map((r: any) => r.balance_after).sort()).toEqual([0, 1, 2, 3, 4]);
    });

    it('lists stock, flags low stock, and searches', async () => {
      await adjust(variantId, { delta: -3, reason: 'adjustment' }).expect(200);
      const low = (await t.http.get('/api/admin/inventory?low=true').set(bearer(owner)).expect(200)).body;
      expect(low.total).toBe(1);
      expect(low.items[0]).toMatchObject({ stock: 2, low_stock_at: 3, product_name: 'Saffron Dusk' });
      expect((await t.http.get('/api/admin/inventory?q=zzz').set(bearer(owner))).body.total).toBe(0);
    });

    it('a login limited to other screens cannot adjust stock', async () => {
      const { token } = await tokenFor(t, ['products']);
      await adjust(variantId, { delta: 1, reason: 'purchase' }, token).expect(403);
      expect((await t.db.query('SELECT stock FROM product_variants WHERE id = $1', [variantId]))[0].stock).toBe(5);
    });
  });

  // ── uploads ───────────────────────────────────────────────────────────────
  describe('image presign', () => {
    const presign = (body: object) => t.http.post('/api/admin/uploads/presign').set(bearer(owner)).send(body);

    it('returns a signed R2 PUT for the declared type/size and a key the product API accepts', async () => {
      const res = (await presign({ content_type: 'image/webp', size: 200_000 }).expect(200)).body;
      expect(res.key).toMatch(/^media\/[0-9a-f-]{36}\.webp$/);
      expect(res.upload_url).toContain('smellme-public-test.testacct.r2.cloudflarestorage.com');
      expect(res.headers['Content-Type']).toBe('image/webp');
      await t.http.post('/api/admin/products').set(bearer(owner)).send(productPayload(refs, { media: [{ key: res.key }] })).expect(201);
    });

    it.each([['image/svg+xml', 1000], ['text/html', 1000], ['image/png', 6 * 1024 * 1024], ['image/png', 0]])(
      'rejects %s of %s bytes', async (content_type, size) => {
        await presign({ content_type, size }).expect(400);
      });
  });
});
