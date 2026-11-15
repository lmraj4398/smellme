import './utils/test-env';
import { buildApp, TestApp } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';
import { seedShop, Shop } from './utils/shop-fixtures';

describe('cart pricing (server-side)', () => {
  let t: TestApp;
  let shop: Shop;
  beforeEach(async () => { t = await buildApp(); shop = await seedShop(t); });
  afterEach(() => t.close());

  const price = (body: object) => t.http.post('/api/cart/price').send(body);
  const line = (variant_id: string, qty = 1) => ({ variant_id, qty });
  const admin = (m: 'post' | 'put', url: string, body: object) => (t.http as any)[m](url).set(bearer(shop.owner)).send(body);
  const coupon = (over: object = {}) => admin('post', '/api/admin/coupons', { code: 'WELCOME10', type: 'percent', value: 10, ...over });

  describe('totals', () => {
    it('is public, plain and needs no login', async () => {
      const res = await price({ lines: [line(shop.v.ml50)] }).expect(200);
      expect(res.body.subtotal_paise).toBe(285000);
    });

    it('prices from the database: line totals, free delivery over the threshold, no wrap', async () => {
      const r = (await price({ lines: [line(shop.v.ml50, 2)] }).expect(200)).body;
      expect(r.lines).toHaveLength(1);
      expect(r.lines[0]).toMatchObject({ unit_price_paise: 285000, qty: 2, line_total_paise: 570000, name: 'Saffron Dusk', label: '50 ml' });
      expect(r).toMatchObject({ subtotal_paise: 570000, delivery_fee_paise: 0, gift_wrap_paise: 0, discount_paise: 0, total_paise: 570000 });
    });

    it('charges delivery under the free-delivery threshold, and not at or above it', async () => {
      expect((await price({ lines: [line(shop.v.rose)] })).body).toMatchObject({ subtotal_paise: 145000, delivery_fee_paise: 9900, total_paise: 154900 });
      // exactly ₹2,000: free
      await admin('put', '/api/admin/settings/shop', { free_delivery_over_paise: 145000, delivery_fee_paise: 9900, gift_wrap_paise: 15000, free_samples_count: 2, delivery_eta_text: '3-7 days' }).expect(200);
      expect((await price({ lines: [line(shop.v.rose)] })).body.delivery_fee_paise).toBe(0);
    });

    it('adds the gift-wrap price only when asked (and never for an empty bag)', async () => {
      expect((await price({ lines: [line(shop.v.ml50)], gift_wrap: true })).body).toMatchObject({ gift_wrap_paise: 15000, total_paise: 300000 });
      expect((await price({ lines: [], gift_wrap: true })).body).toMatchObject({ gift_wrap_paise: 0, total_paise: 0 });
    });

    it('merges the same size listed twice into one line', async () => {
      const r = (await price({ lines: [line(shop.v.ml50, 1), line(shop.v.ml50, 2)] })).body;
      expect(r.lines).toHaveLength(1);
      expect(r.lines[0].qty).toBe(3);
    });

    it('shop settings changes apply immediately', async () => {
      await admin('put', '/api/admin/settings/shop', { free_delivery_over_paise: 1_000_000, delivery_fee_paise: 5000, gift_wrap_paise: 20000, free_samples_count: 2, delivery_eta_text: 'x' }).expect(200);
      expect((await price({ lines: [line(shop.v.ml50)], gift_wrap: true })).body).toMatchObject({ delivery_fee_paise: 5000, gift_wrap_paise: 20000, total_paise: 285000 + 5000 + 20000 });
    });

    it('never accepts a price (or any extra field) from the client', async () => {
      await price({ lines: [{ variant_id: shop.v.ml50, qty: 1, price_paise: 1 }] }).expect(400);
      await price({ lines: [line(shop.v.ml50)], total_paise: 1 }).expect(400);
      await price({ lines: [line(shop.v.ml50)], discount_paise: 99999999 }).expect(400);
    });

    it.each([['qty 0', { qty: 0 }], ['qty 10', { qty: 10 }], ['negative', { qty: -1 }], ['fraction', { qty: 1.5 }], ['text', { qty: '2' }]])('400 for %s', async (_n, over) => {
      await price({ lines: [{ variant_id: shop.v.ml50, ...over }] }).expect(400);
    });

    it('400 for a malformed id, and for more than 9 of one size via duplicate lines', async () => {
      await price({ lines: [{ variant_id: 'nope', qty: 1 }] }).expect(400);
      await price({ lines: [line(shop.v.ml50, 5), line(shop.v.ml50, 5)] }).expect(400);
    });
  });

  describe('availability', () => {
    it('flags a size with too little stock, reports how many are left, and leaves it out of the totals', async () => {
      const r = (await price({ lines: [line(shop.v.ml100, 3), line(shop.v.ml50)] })).body;
      const short = r.lines.find((l: any) => l.label === '100 ml');
      expect(short).toMatchObject({ issue: 'insufficient_stock', available: 2 });
      expect(r.issues).toHaveLength(1);
      expect(r.subtotal_paise).toBe(285000);
    });

    it('flags unknown, retired and hidden-product sizes as unavailable', async () => {
      await t.db.query('UPDATE product_variants SET is_active = false WHERE id = $1', [shop.v.ml50]);
      await t.db.query('UPDATE products SET is_active = false WHERE id = $1', [shop.productIds.rose]);
      const r = (await price({ lines: [line(shop.v.ml50), line(shop.v.rose), line('11111111-1111-4111-8111-111111111111')] })).body;
      expect(r.issues.map((l: any) => l.issue)).toEqual(['unavailable', 'unavailable', 'unavailable']);
      expect(r.total_paise).toBe(0);
    });

    it('flags a size whose brand or scent family has been switched off', async () => {
      await t.db.query('UPDATE brands SET is_active = false');
      expect((await price({ lines: [line(shop.v.ml50)] })).body.issues).toHaveLength(1);
    });
  });

  describe('free samples', () => {
    it('adds chosen samples at ₹0 (and they do not count towards the subtotal)', async () => {
      const r = (await price({ lines: [line(shop.v.ml50)], free_sample_ids: [shop.v.sample, shop.v.roseSample] })).body;
      const free = r.lines.filter((l: any) => l.is_free_sample);
      expect(free.map((l: any) => [l.unit_price_paise, l.qty])).toEqual([[0, 1], [0, 1]]);
      expect(r.subtotal_paise).toBe(285000);
    });

    it('allows at most the configured number, only real sample vials', async () => {
      await price({ lines: [line(shop.v.ml50)], free_sample_ids: [shop.v.sample, shop.v.roseSample, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'] }).expect(400);
      await price({ lines: [line(shop.v.ml50)], free_sample_ids: [shop.v.ml100] }).expect(400);
    });

    it('a sample that is out of stock is flagged, including when also bought', async () => {
      await t.db.query('UPDATE product_variants SET stock = 1 WHERE id = $1', [shop.v.sample]);
      const r = (await price({ lines: [line(shop.v.sample, 1)], free_sample_ids: [shop.v.sample] })).body;
      expect(r.issues.map((l: any) => [l.is_free_sample, l.issue])).toEqual([[true, 'insufficient_stock']]);
    });

    it('is off when the owner sets the count to 0', async () => {
      await admin('put', '/api/admin/settings/shop', { free_delivery_over_paise: 200000, delivery_fee_paise: 9900, gift_wrap_paise: 15000, free_samples_count: 0, delivery_eta_text: 'x' }).expect(200);
      await price({ lines: [line(shop.v.ml50)], free_sample_ids: [shop.v.sample] }).expect(400);
    });
  });

  describe('coupons', () => {
    it('percent: rounds down, never above the cap, never above the subtotal', async () => {
      await coupon({ code: 'TEN', value: 10, max_discount_paise: 20000 }).expect(201);
      expect((await price({ lines: [line(shop.v.ml50)], coupon_code: 'ten' })).body).toMatchObject({ discount_paise: 20000, total_paise: 285000 - 20000, coupon: { code: 'TEN' } });
      await coupon({ code: 'ALL', value: 100 }).expect(201);
      expect((await price({ lines: [line(shop.v.ml50)], coupon_code: 'ALL' })).body.discount_paise).toBe(285000);
    });

    it('flat: capped at the subtotal', async () => {
      await coupon({ code: 'FLAT500', type: 'flat', value: 50000 }).expect(201);
      expect((await price({ lines: [line(shop.v.ml50)], coupon_code: 'FLAT500' })).body.discount_paise).toBe(50000);
      await coupon({ code: 'HUGE', type: 'flat', value: 9_000_000 }).expect(201);
      expect((await price({ lines: [line(shop.v.rose)], coupon_code: 'HUGE' })).body.discount_paise).toBe(145000);
    });

    it('delivery is judged BEFORE the coupon (a coupon cannot make you lose free delivery)', async () => {
      await coupon({ code: 'BIG', type: 'flat', value: 100000 }).expect(201);
      const r = (await price({ lines: [line(shop.v.ml50)], coupon_code: 'BIG' })).body;
      expect(r.delivery_fee_paise).toBe(0);
      expect(r.total_paise).toBe(185000);
    });

    it('enforces the minimum order and says how much more is needed', async () => {
      await coupon({ code: 'MIN', min_order_paise: 300000 }).expect(201);
      const r = (await price({ lines: [line(shop.v.ml50)], coupon_code: 'MIN' })).body;
      expect(r.discount_paise).toBe(0);
      expect(r.coupon_error).toBe('Add ₹150 more to use this coupon');
    });

    it('treats unknown, switched-off, not-started and expired codes identically', async () => {
      const day = 24 * 3600 * 1000;
      await coupon({ code: 'OFF', is_active: false }).expect(201);
      await coupon({ code: 'SOON', starts_at: new Date(Date.now() + day).toISOString() }).expect(201);
      await coupon({ code: 'OLD', starts_at: new Date(Date.now() - 3 * day).toISOString(), ends_at: new Date(Date.now() - day).toISOString() }).expect(201);
      const msgs = await Promise.all(['NOPE', 'OFF', 'SOON', 'OLD'].map(async (c) => (await price({ lines: [line(shop.v.ml50)], coupon_code: c })).body.coupon_error));
      expect(new Set(msgs)).toEqual(new Set(['This coupon isn’t valid']));
    });

    it('stops working once its total uses are spent', async () => {
      await coupon({ code: 'ONCE', max_uses: 1 }).expect(201);
      await t.db.query("UPDATE coupons SET used_count = 1 WHERE code = 'ONCE'");
      expect((await price({ lines: [line(shop.v.ml50)], coupon_code: 'ONCE' })).body.coupon_error).toMatch(/fully used/);
    });

    it('the public validate endpoint answers the same way', async () => {
      await coupon({ code: 'SAVE', value: 10 }).expect(201);
      expect((await t.http.post('/api/coupons/validate').send({ code: 'save', subtotal_paise: 100000 }).expect(200)).body).toMatchObject({ valid: true, discount_paise: 10000, code: 'SAVE' });
      expect((await t.http.post('/api/coupons/validate').send({ code: 'nope', subtotal_paise: 100000 }).expect(200)).body).toEqual({ valid: false, message: 'This coupon isn’t valid' });
    });
  });

  describe('free-sample choices', () => {
    it('lists only in-stock, on-sale sample vials of visible products, without any stock counts', async () => {
      const res = (await t.http.get('/api/samples').expect(200)).body;
      expect(res.map((x: any) => x.variant_id).sort()).toEqual([shop.v.sample, shop.v.roseSample].sort());
      expect(res[0]).toMatchObject({ product_name: expect.any(String), brand: 'SmellMe Originals', label: '2 ml sample' });
      expect(JSON.stringify(res)).not.toMatch(/stock|price/);
    });

    it('drops a sample that sells out, that is retired, or whose product is hidden', async () => {
      await t.db.query('UPDATE product_variants SET stock = 0 WHERE id = $1', [shop.v.sample]);
      await t.db.query('UPDATE products SET is_active = false WHERE id = $1', [shop.productIds.rose]);
      expect((await t.http.get('/api/samples').expect(200)).body).toEqual([]);
    });
  });

  describe('delivery check + public settings', () => {
    it('validates the pincode and returns the delivery estimate', async () => {
      expect((await t.http.get('/api/delivery/check?pincode=560001').expect(200)).body).toMatchObject({ pincode: '560001', serviceable: true, eta_text: expect.any(String) });
      for (const bad of ['056001', '5600', 'abcdef', '']) await t.http.get(`/api/delivery/check?pincode=${bad}`).expect(400);
    });

    it('publishes delivery/wrap prices and the states list, but nothing about payment', async () => {
      const s = (await t.http.get('/api/settings/public').expect(200)).body;
      expect(s).toMatchObject({ delivery_fee_paise: 9900, gift_wrap_paise: 15000, free_samples_count: 2 });
      expect(s.states).toContain('Karnataka');
      expect(JSON.stringify(s)).not.toMatch(/upi|vpa|smellme@/i);
    });
  });
});
