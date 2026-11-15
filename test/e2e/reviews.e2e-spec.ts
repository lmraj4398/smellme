import './utils/test-env';
import { randomUUID } from 'crypto';
import { buildApp, customerLogin, tokenFor, TestApp } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';
import { placeOrder, seedShop, Shop } from './utils/shop-fixtures';

describe('product reviews', () => {
  let t: TestApp;
  let shop: Shop;
  beforeEach(async () => { t = await buildApp(); shop = await seedShop(t); });
  afterEach(() => t.close());

  const saffron = () => shop.productIds.saffron;
  const mine = (token: string, productId = saffron()) => t.http.get(`/api/customer/reviews/${productId}`).set(bearer(token));
  const write = (token: string, body: object, productId = saffron()) => t.http.put(`/api/customer/reviews/${productId}`).set(bearer(token)).send(body);
  const list = (slug = 'saffron-dusk', qs = '') => t.http.get(`/api/products/${slug}/reviews${qs}`);
  const deliver = () => t.db.query("UPDATE orders SET status = 'DELIVERED'");
  /** A customer whose order for Saffron Dusk has been delivered. */
  const buyer = async (phone = '9876543210', name = 'Anaya Rao') => {
    const c = await customerLogin(t, phone, name);
    await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.ml50, qty: 1 }] }).expect(201);
    await deliver();
    return c;
  };

  describe('who can review', () => {
    it('needs a customer login', async () => {
      await t.http.get(`/api/customer/reviews/${saffron()}`).expect(401);
      await t.http.put(`/api/customer/reviews/${saffron()}`).send({ rating: 5 }).expect(401);
      await write(shop.owner, { rating: 5 }).expect(401);
    });

    it('refuses someone who never ordered it', async () => {
      const c = await customerLogin(t);
      expect((await mine(c.token).expect(200)).body).toEqual({ can_review: false, review: null });
      await write(c.token, { rating: 5 }).expect(403);
    });

    it('refuses an order that has not been delivered yet', async () => {
      const c = await customerLogin(t);
      await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.ml50, qty: 1 }] }).expect(201);
      expect((await mine(c.token)).body.can_review).toBe(false);
      await write(c.token, { rating: 5 }).expect(403);
    });

    it('refuses a review of a different product than the one delivered', async () => {
      const c = await buyer();
      expect((await mine(c.token, shop.productIds.rose)).body.can_review).toBe(false);
      await write(c.token, { rating: 5 }, shop.productIds.rose).expect(403);
    });

    it('allows it once the order is delivered', async () => {
      const c = await buyer();
      expect((await mine(c.token)).body).toEqual({ can_review: true, review: null });
      await write(c.token, { rating: 5, title: 'Lovely', body: 'Lasts all day.' }).expect(200);
    });

    it('does not count a free sample that came with another purchase', async () => {
      const c = await customerLogin(t);
      await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.rose, qty: 1 }] }).expect(201);
      await t.db.query("UPDATE orders SET status = 'DELIVERED'");
      await t.db.query('UPDATE order_items SET is_free_sample = true WHERE product_id = $1', [shop.productIds.rose]);
      expect((await mine(c.token, shop.productIds.rose)).body.can_review).toBe(false);
    });
  });

  describe('writing', () => {
    it('validates the rating and the lengths', async () => {
      const c = await buyer();
      for (const rating of [0, 6, 2.5, 'five', undefined]) await write(c.token, { rating }).expect(400);
      await write(c.token, { rating: 5, title: 'x'.repeat(81) }).expect(400);
      await write(c.token, { rating: 5, body: 'x'.repeat(1501) }).expect(400);
      await write(c.token, { rating: 5, extra: 'nope' }).expect(400);
    });

    it('keeps one review per customer: writing again edits it', async () => {
      const c = await buyer();
      await write(c.token, { rating: 3, title: 'Okay' }).expect(200);
      const second = await write(c.token, { rating: 5, title: 'Grew on me', body: 'Better after a week.' }).expect(200);
      expect(second.body).toMatchObject({ rating: 5, title: 'Grew on me', status: 'published' });
      expect((await list()).body.items).toHaveLength(1);
      expect((await mine(c.token)).body.review).toMatchObject({ rating: 5, title: 'Grew on me' });
    });

    it('lets a customer delete their review', async () => {
      const c = await buyer();
      await write(c.token, { rating: 4 }).expect(200);
      await t.http.delete(`/api/customer/reviews/${saffron()}`).set(bearer(c.token)).expect(200);
      expect((await list()).body.items).toEqual([]);
      expect((await mine(c.token)).body.review).toBeNull();
    });
  });

  describe('reading', () => {
    it('is public and shows a rating summary, newest first, with abbreviated names', async () => {
      const a = await buyer('9876543210', 'Anaya Rao');
      const b = await buyer('9000000002', 'Karan');
      await write(a.token, { rating: 5, title: 'Beautiful', body: 'Compliments all day.' }).expect(200);
      await write(b.token, { rating: 4 }).expect(200);
      const res = await list().expect(200);
      expect(res.body.summary).toEqual({ count: 2, average: 4.5, distribution: { 5: 1, 4: 1, 3: 0, 2: 0, 1: 0 } });
      expect(res.body.items.map((r: { author: string }) => r.author)).toEqual(['Karan', 'Anaya R.']);
      expect(res.body.items[1]).toMatchObject({ rating: 5, title: 'Beautiful', verified: true });
      expect(JSON.stringify(res.body)).not.toMatch(/Rao|9876|customer_id|phone/);
    });

    it('is an empty summary for a product with no reviews, and 404 for an unknown one', async () => {
      expect((await list().expect(200)).body).toMatchObject({ summary: { count: 0, average: 0 }, items: [] });
      await list('no-such-scent').expect(404);
    });

    it('pages through reviews', async () => {
      for (let i = 0; i < 3; i++) await write((await buyer(`90000000${i}1`, `Buyer ${i}`)).token, { rating: 5 }).expect(200);
      const p1 = (await list('saffron-dusk', '?limit=2&page=1').expect(200)).body;
      const p2 = (await list('saffron-dusk', '?limit=2&page=2').expect(200)).body;
      expect([p1.items.length, p2.items.length]).toEqual([2, 1]);
      expect(p1.summary.count).toBe(3);
    });
  });

  describe('moderation', () => {
    const adminList = (token: string, qs = '') => t.http.get(`/api/admin/reviews${qs}`).set(bearer(token));

    it('is only for admins with the reviews screen', async () => {
      const c = await buyer();
      await adminList(c.token).expect(401);
      await t.http.get('/api/admin/reviews').expect(401);
      const limited = (await tokenFor(t, ['orders'])).token;
      await adminList(limited).expect(403);
      await adminList((await tokenFor(t, ['reviews'])).token).expect(200);
    });

    it('lists reviews with who wrote them and what for, filterable by status', async () => {
      const c = await buyer();
      await write(c.token, { rating: 2, title: 'Too sweet' }).expect(200);
      const res = await adminList(shop.owner).expect(200);
      expect(res.body).toMatchObject({ total: 1, hidden: 0 });
      expect(res.body.items[0]).toMatchObject({ rating: 2, title: 'Too sweet', status: 'published', product_name: 'Saffron Dusk', customer_phone: '+919876543210' });
      expect((await adminList(shop.owner, '?status=hidden')).body.items).toEqual([]);
      await adminList(shop.owner, '?status=bogus').expect(400);
    });

    it('hides a review from the shop and the rating, and restores it', async () => {
      const c = await buyer();
      const id = (await write(c.token, { rating: 1, title: 'Spam' }).expect(200)).body.id;
      await t.http.patch(`/api/admin/reviews/${id}`).set(bearer(shop.owner)).send({ status: 'hidden' }).expect(200);
      const hidden = (await list()).body;
      expect(hidden.items).toEqual([]);
      expect(hidden.summary.count).toBe(0);
      expect((await adminList(shop.owner)).body.hidden).toBe(1);
      await t.http.patch(`/api/admin/reviews/${id}`).set(bearer(shop.owner)).send({ status: 'published' }).expect(200);
      expect((await list()).body.items).toHaveLength(1);
    });

    it('keeps a hidden review hidden when its author edits it', async () => {
      const c = await buyer();
      const id = (await write(c.token, { rating: 1 }).expect(200)).body.id;
      await t.http.patch(`/api/admin/reviews/${id}`).set(bearer(shop.owner)).send({ status: 'hidden' }).expect(200);
      expect((await write(c.token, { rating: 2, title: 'Edited' }).expect(200)).body.status).toBe('hidden');
      expect((await list()).body.items).toEqual([]);
    });

    it('404s for an unknown review and 400s for a bad status', async () => {
      await t.http.patch(`/api/admin/reviews/${randomUUID()}`).set(bearer(shop.owner)).send({ status: 'hidden' }).expect(404);
      await t.http.patch(`/api/admin/reviews/${randomUUID()}`).set(bearer(shop.owner)).send({ status: 'deleted' }).expect(400);
    });
  });
});

