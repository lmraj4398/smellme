import './utils/test-env';
import { randomUUID } from 'crypto';
import { buildApp, customerLogin, customerToken, TestApp, tokenFor } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';
import { ADDRESS, customerWithOrder, placeOrder, seedShop, Shop, stockOf, submitReceiptOk } from './utils/shop-fixtures';

describe('customer orders', () => {
  let t: TestApp;
  let shop: Shop;
  beforeEach(async () => { t = await buildApp(); shop = await seedShop(t); });
  afterEach(() => t.close());

  const line = (variant_id: string, qty = 1) => ({ variant_id, qty });
  const mine = (token: string, no: string) => t.http.get(`/api/customer/orders/${no}`).set(bearer(token));

  describe('placing an order', () => {
    it('needs a customer login (not an admin one, not none)', async () => {
      await t.http.post('/api/customer/orders').send({ client_ref: randomUUID(), address: ADDRESS, lines: [line(shop.v.ml50)] }).expect(401);
      await t.http.post('/api/customer/orders').set(bearer(shop.owner)).send({ client_ref: randomUUID(), address: ADDRESS, lines: [line(shop.v.ml50)] }).expect(401);
    });

    it('creates a PENDING_PAYMENT order priced by the server, with the QR payment details', async () => {
      const c = await customerLogin(t);
      const res = await placeOrder(t, c.token, { lines: [line(shop.v.ml50, 2)], gift_wrap: true, gift_message: 'For Priya', engraving: 'PRIYA' }).expect(201);
      const o = res.body;
      expect(o.order_no).toMatch(/^SM-00\d{4}$/);
      expect(o.status).toBe('PENDING_PAYMENT');
      expect(o.totals).toEqual({ subtotal_paise: 570000, discount_paise: 0, delivery_fee_paise: 0, gift_wrap_paise: 15000, total_paise: 585000 });
      expect(o.gift).toEqual({ wrap: true, message: 'For Priya', engraving: 'PRIYA' });
      expect(o.address).toMatchObject({ name: 'Anaya Rao', phone: '+919876543210', state: 'Karnataka' });
      expect(o.payment).toMatchObject({ upi_vpa: 'smellme@okhdfcbank', amount_paise: 585000, reference: o.order_no });
      expect(o.can_upload_receipt).toBe(true);
    });

    it('the UPI link identifies the payee and the order but carries NO amount (the customer pays the amount shown)', async () => {
      const c = await customerLogin(t);
      const { payment } = (await placeOrder(t, c.token, { lines: [line(shop.v.ml50)] }).expect(201)).body;
      const u = new URL(payment.upi_uri);
      expect(u.protocol).toBe('upi:');
      expect(u.searchParams.get('pa')).toBe('smellme@okhdfcbank');
      expect(u.searchParams.get('tn')).toBe(payment.reference);
      expect(u.searchParams.has('am')).toBe(false);
    });

    it('holds stock immediately - including the free samples - and writes sale rows to the ledger', async () => {
      const c = await customerLogin(t);
      const o = (await placeOrder(t, c.token, { lines: [line(shop.v.ml50, 2)], free_sample_ids: [shop.v.sample, shop.v.roseSample] }).expect(201)).body;
      expect(await stockOf(t, shop.v.ml50)).toBe(8);
      expect(await stockOf(t, shop.v.sample)).toBe(4);
      expect(await stockOf(t, shop.v.roseSample)).toBe(3);
      const sales = await t.db.query("SELECT delta, ref FROM stock_ledger WHERE reason = 'sale' ORDER BY delta");
      expect(sales).toHaveLength(3);
      expect(new Set(sales.map((s: any) => s.ref))).toEqual(new Set([o.order_no]));
      expect(o.items.filter((i: any) => i.is_free_sample)).toHaveLength(2);
    });

    it('snapshots what was bought: later price changes or removing the product do not alter the order', async () => {
      const c = await customerLogin(t);
      const o = (await placeOrder(t, c.token, { lines: [line(shop.v.ml50)] }).expect(201)).body;
      await t.db.query('UPDATE product_variants SET price_paise = 1 WHERE id = $1', [shop.v.ml50]);
      await t.db.query('UPDATE products SET is_active = false, name = $1', ['Renamed']);
      const again = (await mine(c.token, o.order_no).expect(200)).body;
      expect(again.totals.total_paise).toBe(285000);
      expect(again.items[0]).toMatchObject({ name: 'Saffron Dusk', unit_price_paise: 285000, label: '50 ml' });
    });

    it('applies a coupon, counts its use, and snapshots the discount', async () => {
      await t.http.post('/api/admin/coupons').set(bearer(shop.owner)).send({ code: 'TEN', type: 'percent', value: 10 }).expect(201);
      const c = await customerLogin(t);
      const o = (await placeOrder(t, c.token, { lines: [line(shop.v.ml50)], coupon_code: 'ten' }).expect(201)).body;
      expect(o.totals).toMatchObject({ discount_paise: 28500, total_paise: 256500 });
      expect(o.coupon_code).toBe('TEN');
      expect((await t.db.query("SELECT used_count FROM coupons WHERE code = 'TEN'"))[0].used_count).toBe(1);
    });

    it('a coupon limited to one use per customer cannot be used twice, but works for someone else', async () => {
      await t.http.post('/api/admin/coupons').set(bearer(shop.owner)).send({ code: 'ONE', type: 'flat', value: 10000 }).expect(201);
      const a = await customerLogin(t, '9000000001');
      await placeOrder(t, a.token, { lines: [line(shop.v.ml50)], coupon_code: 'ONE' }).expect(201);
      const second = await placeOrder(t, a.token, { lines: [line(shop.v.ml50)], coupon_code: 'ONE' }).expect(400);
      expect(second.body.message).toMatch(/already used/i);
      const b = await customerLogin(t, '9000000002');
      await placeOrder(t, b.token, { lines: [line(shop.v.ml50)], coupon_code: 'ONE' }).expect(201);
    });

    it('a coupon with one use left goes to exactly one of two simultaneous buyers', async () => {
      await t.http.post('/api/admin/coupons').set(bearer(shop.owner)).send({ code: 'LAST', type: 'flat', value: 10000, max_uses: 1 }).expect(201);
      const [a, b] = await Promise.all([customerLogin(t, '9000000001'), customerLogin(t, '9000000002')]);
      const rs = await Promise.all([a, b].map((c) => placeOrder(t, c.token, { lines: [line(shop.v.ml50)], coupon_code: 'LAST' })));
      expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
      expect((await t.db.query("SELECT used_count FROM coupons WHERE code = 'LAST'"))[0].used_count).toBe(1);
    });

    it('is idempotent: the same client_ref returns the same order and takes stock once', async () => {
      const c = await customerLogin(t);
      const ref = randomUUID();
      const first = (await placeOrder(t, c.token, { client_ref: ref, lines: [line(shop.v.ml50)] }).expect(201)).body;
      const again = (await placeOrder(t, c.token, { client_ref: ref, lines: [line(shop.v.ml50)] }).expect(201)).body;
      expect(again.order_no).toBe(first.order_no);
      expect(await stockOf(t, shop.v.ml50)).toBe(9);
      expect(await t.db.query('SELECT 1 FROM orders')).toHaveLength(1);
    });

    it('is idempotent under a double-click: 6 simultaneous identical submits make ONE order', async () => {
      const c = await customerLogin(t);
      const ref = randomUUID();
      const rs = await Promise.all(Array.from({ length: 6 }, () => placeOrder(t, c.token, { client_ref: ref, lines: [line(shop.v.ml50)] })));
      expect(rs.every((r) => r.status === 201)).toBe(true);
      expect(new Set(rs.map((r) => r.body.order_no)).size).toBe(1);
      expect(await t.db.query('SELECT 1 FROM orders')).toHaveLength(1);
      expect(await stockOf(t, shop.v.ml50)).toBe(9);
    });

    it('two customers racing for the LAST unit: exactly one wins, stock never goes negative', async () => {
      await t.db.query('UPDATE product_variants SET stock = 1 WHERE id = $1', [shop.v.ml100]);
      const [a, b] = await Promise.all([customerLogin(t, '9000000001'), customerLogin(t, '9000000002')]);
      const rs = await Promise.all([a, b].map((c) => placeOrder(t, c.token, { lines: [line(shop.v.ml100)] })));
      expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await stockOf(t, shop.v.ml100)).toBe(0);
      expect(await t.db.query('SELECT 1 FROM orders')).toHaveLength(1);
    });

    it('20 customers, 3 units: exactly 3 orders succeed', async () => {
      await t.db.query('UPDATE product_variants SET stock = 3 WHERE id = $1', [shop.v.ml100]);
      const tokens = [];
      for (let i = 0; i < 20; i++) tokens.push(await customerToken(t, String(9000010000 + i)));
      const rs = await Promise.all(tokens.map((token) => placeOrder(t, token, { lines: [line(shop.v.ml100)] })));
      expect(rs.filter((r) => r.status === 201)).toHaveLength(3);
      expect(await stockOf(t, shop.v.ml100)).toBe(0);
    });

    it('is all-or-nothing: if one line cannot be filled nothing is reserved', async () => {
      const c = await customerLogin(t);
      const res = await placeOrder(t, c.token, { lines: [line(shop.v.ml50, 2), line(shop.v.ml100, 5)] }).expect(409);
      expect(res.body.message).toMatch(/Saffron Dusk 100 ml \(only 2 left\)/);
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
      expect(await t.db.query('SELECT 1 FROM orders')).toHaveLength(0);
      expect(await t.db.query("SELECT 1 FROM stock_ledger WHERE reason = 'sale'")).toHaveLength(0);
    });

    it('rolls back everything if a free sample cannot be filled', async () => {
      await t.db.query('UPDATE product_variants SET stock = 0 WHERE id = $1', [shop.v.sample]);
      const c = await customerLogin(t);
      await placeOrder(t, c.token, { lines: [line(shop.v.ml50)], free_sample_ids: [shop.v.sample] }).expect(409);
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
    });

    it('rejects an invalid coupon without creating an order', async () => {
      const c = await customerLogin(t);
      await placeOrder(t, c.token, { lines: [line(shop.v.ml50)], coupon_code: 'NOPE' }).expect(400);
      expect(await t.db.query('SELECT 1 FROM orders')).toHaveLength(0);
    });

    it.each([
      ['empty bag', { lines: [] }, 400],
      ['unknown state', { address: { ...ADDRESS, state: 'Atlantis' } }, 400],
      ['bad pincode', { address: { ...ADDRESS, pincode: '000000' } }, 400],
      ['bad phone', { address: { ...ADDRESS, phone: '12345' } }, 400],
      ['missing address', { address: undefined }, 400],
      ['engraving too long', { engraving: 'A'.repeat(15) }, 400],
      ['engraving with markup', { engraving: '<b>x</b>' }, 400],
      ['gift message too long', { gift_message: 'x'.repeat(251) }, 400],
      ['no client_ref', { client_ref: undefined }, 400],
      ['price from the client', { total_paise: 1 }, 400],
      ['status from the client', { status: 'PAID' }, 400],
      ['customer id from the client', { customer_id: randomUUID() }, 400],
    ])('400: %s', async (_n, over, status) => {
      const c = await customerLogin(t);
      await t.http.post('/api/customer/orders').set(bearer(c.token)).send({ client_ref: randomUUID(), address: ADDRESS, lines: [line(shop.v.ml50)], ...over }).expect(status);
      expect(await t.db.query('SELECT 1 FROM orders')).toHaveLength(0);
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
    });

    it('sends the "order placed" WhatsApp message to the customer', async () => {
      const c = await customerWithOrder(t, shop);
      await new Promise((r) => setTimeout(r, 200));
      const m = t.wa.sent.find((x) => x.templateId === 'order_placed')!;
      expect(m.to).toBe('919876543210');
      expect(m.params).toEqual(['Anaya Rao', c.order.order_no, '₹2,850']);
    });

    it('a WhatsApp outage never blocks or fails an order', async () => {
      const c = await customerLogin(t);
      t.wa.failNext = true;
      await placeOrder(t, c.token, { lines: [line(shop.v.ml50)] }).expect(201);
      await new Promise((r) => setTimeout(r, 200));
      expect((await t.db.query("SELECT status FROM whatsapp_messages WHERE event = 'order_placed'"))[0].status).toBe('failed');
    });
  });

  describe("one customer can never touch another's orders", () => {
    it('GET / receipt / cancel on someone else’s order number is a plain 404, and nothing changes', async () => {
      const alice = await customerWithOrder(t, shop, '9000000001');
      const bob = await customerLogin(t, '9000000002');
      const no = alice.order.order_no;
      await mine(bob.token, no).expect(404);
      await t.http.post(`/api/customer/orders/${no}/receipt/presign`).set(bearer(bob.token)).send({ content_type: 'image/png', size: 100 }).expect(404);
      await t.http.post(`/api/customer/orders/${no}/receipt`).set(bearer(bob.token)).send({ key: 'receipts/x/y.png' }).expect(404);
      await t.http.post(`/api/customer/orders/${no}/cancel`).set(bearer(bob.token)).expect(404);
      expect((await mine(alice.token, no).expect(200)).body.status).toBe('PENDING_PAYMENT');
      expect(await stockOf(t, shop.v.ml50)).toBe(9);
    });

    it('a list only ever shows the customer’s own orders', async () => {
      await customerWithOrder(t, shop, '9000000001');
      const bob = await customerWithOrder(t, shop, '9000000002');
      const list = (await t.http.get('/api/customer/orders').set(bearer(bob.token)).expect(200)).body;
      expect(list.total).toBe(1);
      expect(list.items[0].order_no).toBe(bob.order.order_no);
    });

    it('the same client_ref used by two customers makes two separate orders', async () => {
      const ref = randomUUID();
      const a = await customerLogin(t, '9000000001');
      const b = await customerLogin(t, '9000000002');
      const x = await placeOrder(t, a.token, { client_ref: ref, lines: [line(shop.v.ml50)] }).expect(201);
      const y = await placeOrder(t, b.token, { client_ref: ref, lines: [line(shop.v.ml50)] }).expect(201);
      expect(x.body.order_no).not.toBe(y.body.order_no);
    });

    it.each(['SM-000001', 'SM-999999', 'garbage', "SM-001001'; DROP TABLE orders;--", '../admin'])('404 for the order reference %j', async (no) => {
      const c = await customerLogin(t);
      await mine(c.token, encodeURIComponent(no)).expect(404);
    });

    it('401 for every customer order route without a login', async () => {
      await t.http.get('/api/customer/orders').expect(401);
      await t.http.get('/api/customer/orders/SM-001001').expect(401);
      await t.http.post('/api/customer/orders/SM-001001/cancel').expect(401);
    });
  });

  describe('paying: receipt upload', () => {
    it('presigns an upload into the PRIVATE bucket, under a key tied to this order', async () => {
      const c = await customerWithOrder(t, shop);
      const r = (await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type: 'image/webp', size: 90000 }).expect(200)).body;
      expect(r.upload_url).toContain('smellme-private-test.testacct.r2.cloudflarestorage.com');
      expect(r.key).toMatch(new RegExp(`^receipts/${c.orderId}/[0-9a-f-]{36}\\.webp$`));
      expect(r.public_url).toBeUndefined(); // receipts never have a public URL
    });

    it.each([['image/svg+xml', 1000], ['text/html', 1000], ['application/zip', 1000], ['image/png', 6 * 1024 * 1024], ['image/png', 0]])('refuses to presign %s of %s bytes', async (content_type, size) => {
      const c = await customerWithOrder(t, shop);
      await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type, size }).expect(400);
    });

    it('submitting a receipt moves the order to PAYMENT_SUBMITTED and records the claim', async () => {
      const c = await customerWithOrder(t, shop);
      const res = await submitReceiptOk(t, c, { utr: 'ab1234567890', paid_amount_paise: 285000 });
      expect(res.body).toMatchObject({ status: 'PAYMENT_SUBMITTED', payment_submitted: true, can_upload_receipt: false, can_cancel: false });
      expect(res.body.payment).toBeNull(); // nothing left to pay
      const row = (await t.db.query('SELECT utr, paid_amount_paise, receipt_key FROM orders'))[0];
      expect(row).toMatchObject({ utr: 'AB1234567890', paid_amount_paise: 285000 });
      expect(row.receipt_key).toMatch(/^receipts\//);
      expect((await t.db.query("SELECT actor_type FROM order_events WHERE to_status = 'PAYMENT_SUBMITTED'"))[0].actor_type).toBe('customer');
    });

    it('the UTR and amount are optional', async () => {
      const c = await customerWithOrder(t, shop);
      await submitReceiptOk(t, c);
    });

    it('refuses a receipt key that belongs to a different order (cannot reuse or hijack another receipt)', async () => {
      const a = await customerWithOrder(t, shop, '9000000001');
      const b = await customerWithOrder(t, shop, '9000000002');
      const pre = await t.http.post(`/api/customer/orders/${a.order.order_no}/receipt/presign`).set(bearer(a.token)).send({ content_type: 'image/png', size: 2048 }).expect(200);
      t.storage.simulateUpload(pre.body.key);
      const res = await t.http.post(`/api/customer/orders/${b.order.order_no}/receipt`).set(bearer(b.token)).send({ key: pre.body.key }).expect(400);
      expect(res.body.message).toMatch(/doesn’t belong to this order/);
      expect((await mine(b.token, b.order.order_no)).body.status).toBe('PENDING_PAYMENT');
    });

    it.each([
      ['an arbitrary object key', '../../etc/passwd'],
      ['a product image key', 'media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg'],
      ['a lookalike with a wrong separator', 'receipts-xxxxxxxx/a.png'],
    ])('refuses %s', async (_n, key) => {
      const c = await customerWithOrder(t, shop);
      await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt`).set(bearer(c.token)).send({ key }).expect(400);
    });

    it('refuses a receipt that was never actually uploaded', async () => {
      const c = await customerWithOrder(t, shop);
      const pre = await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type: 'image/png', size: 100 }).expect(200);
      const res = await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt`).set(bearer(c.token)).send({ key: pre.body.key }).expect(400);
      expect(res.body.message).toMatch(/couldn’t find your upload/);
    });

    it('checks what R2 actually received: the wrong type for the extension, or an empty/oversized file, is refused', async () => {
      const c = await customerWithOrder(t, shop);
      const pre = (await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type: 'image/png', size: 100 }).expect(200)).body;
      for (const [type, size] of [['text/html', 100], ['image/png', 0], ['image/png', 6 * 1024 * 1024]] as const) {
        t.storage.simulateUpload(pre.key, type, size);
        await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt`).set(bearer(c.token)).send({ key: pre.key }).expect(400);
      }
    });

    it('validates the UTR and amount', async () => {
      const c = await customerWithOrder(t, shop);
      const pre = (await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type: 'image/png', size: 100 }).expect(200)).body;
      t.storage.simulateUpload(pre.key);
      for (const bad of [{ utr: 'x' }, { utr: 'has space ok1' }, { utr: '<script>' }, { paid_amount_paise: -1 }, { paid_amount_paise: 1.5 }]) {
        await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt`).set(bearer(c.token)).send({ key: pre.key, ...bad }).expect(400);
      }
    });

    it('a second submission while one is under review is refused, even if sent at the same time', async () => {
      const c = await customerWithOrder(t, shop);
      const pre = (await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type: 'image/png', size: 100 }).expect(200)).body;
      t.storage.simulateUpload(pre.key);
      const rs = await Promise.all([1, 2, 3].map(() => t.http.post(`/api/customer/orders/${c.order.order_no}/receipt`).set(bearer(c.token)).send({ key: pre.key })));
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      expect((await t.db.query("SELECT 1 FROM order_events WHERE to_status = 'PAYMENT_SUBMITTED'"))).toHaveLength(1);
      await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type: 'image/png', size: 100 }).expect(409);
    });
  });

  describe('customer cancelling', () => {
    it('before paying: cancels, returns every unit (and the free samples) to stock, gives the coupon use back', async () => {
      await t.http.post('/api/admin/coupons').set(bearer(shop.owner)).send({ code: 'TEN', type: 'percent', value: 10 }).expect(201);
      const c = await customerWithOrder(t, shop, '9876543210', [line(shop.v.ml50, 2)], { coupon_code: 'TEN', free_sample_ids: [shop.v.sample] });
      expect(await stockOf(t, shop.v.ml50)).toBe(8);
      const res = await t.http.post(`/api/customer/orders/${c.order.order_no}/cancel`).set(bearer(c.token)).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', refund_due: false });
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
      expect(await stockOf(t, shop.v.sample)).toBe(5);
      expect((await t.db.query("SELECT used_count FROM coupons WHERE code = 'TEN'"))[0].used_count).toBe(0);
      expect((await t.db.query("SELECT count(*)::int AS n FROM stock_ledger WHERE reason = 'return'"))[0].n).toBe(2);
    });

    it('cancelling twice does not return the stock twice', async () => {
      const c = await customerWithOrder(t, shop);
      await t.http.post(`/api/customer/orders/${c.order.order_no}/cancel`).set(bearer(c.token)).expect(200);
      await t.http.post(`/api/customer/orders/${c.order.order_no}/cancel`).set(bearer(c.token)).expect(409);
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
    });

    it('simultaneous cancels return the stock exactly once', async () => {
      const c = await customerWithOrder(t, shop);
      const rs = await Promise.all([1, 2, 3, 4].map(() => t.http.post(`/api/customer/orders/${c.order.order_no}/cancel`).set(bearer(c.token))));
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
    });

    it('once a receipt is submitted the customer can no longer cancel it themselves', async () => {
      const c = await customerWithOrder(t, shop);
      await submitReceiptOk(t, c);
      await t.http.post(`/api/customer/orders/${c.order.order_no}/cancel`).set(bearer(c.token)).expect(409);
      expect(await stockOf(t, shop.v.ml50)).toBe(9);
    });
  });

  it('a customer who got an admin-only 401 is the same as no login: tokens of the wrong kind never work', async () => {
    const admin = (await tokenFor(t, null)).token;
    await t.http.get('/api/customer/orders').set(bearer(admin)).expect(401);
  });
});
