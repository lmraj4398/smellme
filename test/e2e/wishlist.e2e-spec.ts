import './utils/test-env';
import { randomUUID } from 'crypto';
import { buildApp, customerLogin, TestApp } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';
import { seedShop, Shop } from './utils/shop-fixtures';

describe('customer wishlist', () => {
  let t: TestApp;
  let shop: Shop;
  beforeEach(async () => { t = await buildApp(); shop = await seedShop(t); });
  afterEach(() => t.close());

  const put = (token: string, id: string) => t.http.put(`/api/customer/wishlist/${id}`).set(bearer(token));
  const del = (token: string, id: string) => t.http.delete(`/api/customer/wishlist/${id}`).set(bearer(token));
  const ids = async (token: string) => (await t.http.get('/api/customer/wishlist/ids').set(bearer(token)).expect(200)).body.ids as string[];
  const cards = async (token: string) => (await t.http.get('/api/customer/wishlist').set(bearer(token)).expect(200)).body as { id: string; name: string }[];

  it('needs a customer login (not an admin one, not none)', async () => {
    await t.http.get('/api/customer/wishlist').expect(401);
    await t.http.get('/api/customer/wishlist/ids').set(bearer(shop.owner)).expect(401);
    await t.http.put(`/api/customer/wishlist/${shop.productIds.saffron}`).set(bearer(shop.owner)).expect(401);
  });

  it('starts empty', async () => {
    const c = await customerLogin(t);
    expect(await ids(c.token)).toEqual([]);
    expect(await cards(c.token)).toEqual([]);
  });

  it('adds products and lists them newest first, as product cards', async () => {
    const c = await customerLogin(t);
    await put(c.token, shop.productIds.saffron).expect(200);
    await put(c.token, shop.productIds.rose).expect(200);
    expect(await ids(c.token)).toEqual([shop.productIds.rose, shop.productIds.saffron]);
    const list = await cards(c.token);
    expect(list.map((p) => p.name)).toEqual(['Rose Velours', 'Saffron Dusk']);
    expect(list[0]).toMatchObject({ slug: 'rose-velours', default_variant: { id: shop.v.rose } });
  });

  it('is idempotent: hearting twice keeps one row', async () => {
    const c = await customerLogin(t);
    await put(c.token, shop.productIds.saffron).expect(200);
    await put(c.token, shop.productIds.saffron).expect(200);
    expect(await ids(c.token)).toEqual([shop.productIds.saffron]);
  });

  it('removes a product, and removing one that is not there is still fine', async () => {
    const c = await customerLogin(t);
    await put(c.token, shop.productIds.saffron).expect(200);
    await del(c.token, shop.productIds.saffron).expect(200);
    await del(c.token, shop.productIds.saffron).expect(200);
    expect(await ids(c.token)).toEqual([]);
  });

  it('keeps each customer’s wishlist private', async () => {
    const a = await customerLogin(t, '9876543210');
    const b = await customerLogin(t, '9000000002');
    await put(a.token, shop.productIds.saffron).expect(200);
    expect(await ids(b.token)).toEqual([]);
    await del(b.token, shop.productIds.saffron).expect(200);
    expect(await ids(a.token)).toEqual([shop.productIds.saffron]);
  });

  it('404s for an unknown product, 400s for a malformed id', async () => {
    const c = await customerLogin(t);
    await put(c.token, randomUUID()).expect(404);
    await t.http.put('/api/customer/wishlist/not-a-uuid').set(bearer(c.token)).expect(400);
  });

  it('will not wishlist a product that is hidden, and stops showing one that is hidden later', async () => {
    const c = await customerLogin(t);
    await put(c.token, shop.productIds.saffron).expect(200);
    await t.db.query('UPDATE products SET is_active = false WHERE id = $1', [shop.productIds.saffron]);
    expect(await cards(c.token)).toEqual([]);
    await put(c.token, shop.productIds.saffron).expect(404);
  });
});
