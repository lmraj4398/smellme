import './utils/test-env';
import { buildApp, customerLogin, TestApp, tokenFor } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';
import { customerWithOrder, placeOrder, seedShop, Shop, stockOf, submitReceiptOk } from './utils/shop-fixtures';

describe('orders: admin', () => {
  let t: TestApp;
  let shop: Shop;
  beforeEach(async () => { t = await buildApp(); shop = await seedShop(t); });
  afterEach(() => t.close());

  const owner = () => shop.owner;
  const get = (url: string, token = owner()) => t.http.get(url).set(bearer(token));
  const post = (url: string, body: object = {}, token = owner()) => t.http.post(url).set(bearer(token)).send(body);
  const detail = async (id: string) => (await get(`/api/admin/orders/${id}`).expect(200)).body;
  const flush = () => new Promise((r) => setTimeout(r, 250)); // notifications are fire-and-forget

  /** A paid-for-review order: placed, receipt uploaded, waiting for staff. */
  async function submitted(phone = '9876543210', extra: Record<string, unknown> = {}, lines?: { variant_id: string; qty: number }[]) {
    const c = await customerWithOrder(t, shop, phone, lines);
    await submitReceiptOk(t, c, extra);
    return c;
  }
  const approve = (id: string, body: object = {}) => post(`/api/admin/orders/${id}/approve-payment`, body);
  async function paid(phone = '9876543210') {
    const c = await submitted(phone, { paid_amount_paise: 285000 });
    await approve(c.orderId).expect(200);
    return c;
  }

  // ── access control ────────────────────────────────────────────────────────
  describe('access control', () => {
    const routes: [string, string][] = [
      ['get', '/api/admin/orders'], ['get', '/api/admin/orders/summary'], ['get', '/api/admin/customers'],
      ['get', '/api/admin/orders/11111111-1111-4111-8111-111111111111'], ['post', '/api/admin/orders/11111111-1111-4111-8111-111111111111/approve-payment'],
      ['post', '/api/admin/orders/11111111-1111-4111-8111-111111111111/cancel'], ['get', '/api/admin/whatsapp/messages'], ['get', '/api/admin/coupons'],
      ['get', '/api/admin/settings/shop'], ['get', '/api/admin/settings/payment'],
    ];
    it.each(routes)('401 without a token: %s %s', async (m, url) => { await (t.http as any)[m](url).expect(401); });

    it('a customer token is rejected on every admin route', async () => {
      const c = await customerLogin(t, '9000000001');
      for (const [m, url] of routes) await (t.http as any)[m](url).set(bearer(c.token)).expect(401);
    });

    it('a login without the "orders" screen cannot see or change any order', async () => {
      const c = await submitted();
      const { token } = await tokenFor(t, ['products', 'content']);
      await get('/api/admin/orders', token).expect(403);
      await get(`/api/admin/orders/${c.orderId}`, token).expect(403);
      await get(`/api/admin/orders/${c.orderId}/receipt-url`, token).expect(403);
      await post(`/api/admin/orders/${c.orderId}/approve-payment`, {}, token).expect(403);
      await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'x' }, token).expect(403);
      expect((await detail(c.orderId)).status).toBe('PAYMENT_SUBMITTED');
    });

    it('"orders" opens orders but not customers, coupons, settings or logs', async () => {
      const { token } = await tokenFor(t, ['orders']);
      await get('/api/admin/orders', token).expect(200);
      for (const url of ['/api/admin/customers', '/api/admin/coupons', '/api/admin/settings/shop', '/api/admin/whatsapp/messages']) await get(url, token).expect(403);
    });

    it('each screen opens its own area: customers, coupons, logs, settings', async () => {
      await get('/api/admin/customers', (await tokenFor(t, ['customers'])).token).expect(200);
      await get('/api/admin/coupons', (await tokenFor(t, ['coupons'])).token).expect(200);
      await get('/api/admin/whatsapp/messages', (await tokenFor(t, ['logs'])).token).expect(200);
      await get('/api/admin/settings/shop', (await tokenFor(t, ['settings'])).token).expect(200);
    });

    it('the UPI payment address is OWNER-ONLY: even a login holding the "settings" screen cannot read or change it', async () => {
      const { token } = await tokenFor(t, ['settings']);
      await get('/api/admin/settings/payment', token).expect(403);
      await t.http.put('/api/admin/settings/payment').set(bearer(token)).send({ upi_vpa: 'attacker@upi', upi_payee_name: 'Evil' }).expect(403);
      expect((await get('/api/admin/settings/payment').expect(200)).body.upi_vpa).toBe('smellme@okhdfcbank');
    });

    it('a restricted login can still change delivery/wrap prices when it holds "settings"', async () => {
      const { token } = await tokenFor(t, ['settings']);
      await t.http.put('/api/admin/settings/shop').set(bearer(token)).send({ free_delivery_over_paise: 100, delivery_fee_paise: 100, gift_wrap_paise: 100, free_samples_count: 1, delivery_eta_text: 'soon' }).expect(200);
    });
  });

  // ── payment settings ──────────────────────────────────────────────────────
  describe('payment + shop settings', () => {
    it.each(['', 'nobank', 'a@', '@bank', 'two words@upi', 'x@y@z', 'a'.repeat(80) + '@upi', 'name@bank;drop'])('rejects the UPI address %j', async (vpa) => {
      await t.http.put('/api/admin/settings/payment').set(bearer(owner())).send({ upi_vpa: vpa, upi_payee_name: 'SmellMe' }).expect(400);
    });

    it('a changed UPI address applies to the NEXT payment instructions only', async () => {
      const before = await customerWithOrder(t, shop, '9000000001');
      await t.http.put('/api/admin/settings/payment').set(bearer(owner())).send({ upi_vpa: 'newshop@ybl', upi_payee_name: 'SmellMe Perfumes' }).expect(200);
      const c2 = await customerLogin(t, '9000000002');
      const o2 = (await placeOrder(t, c2.token, { lines: [{ variant_id: shop.v.ml50, qty: 1 }] }).expect(201)).body;
      expect(o2.payment.upi_vpa).toBe('newshop@ybl');
      expect(new URL(o2.payment.upi_uri).searchParams.get('pn')).toBe('SmellMe Perfumes');
      expect(before.order.status).toBe('PENDING_PAYMENT');
    });

    it('with no UPI address configured, checkout says payment is unavailable instead of showing a broken QR', async () => {
      await t.db.query("DELETE FROM app_settings WHERE key = 'payment'");
      const c = await customerLogin(t);
      const o = (await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.ml50, qty: 1 }] }).expect(201)).body;
      expect(o.payment).toEqual({ unavailable: true });
    });

    it('validates shop settings', async () => {
      const ok = { free_delivery_over_paise: 1, delivery_fee_paise: 1, gift_wrap_paise: 1, free_samples_count: 2, delivery_eta_text: 'x' };
      for (const bad of [{ delivery_fee_paise: -1 }, { free_samples_count: 6 }, { gift_wrap_paise: 1.5 }, { delivery_eta_text: 'x'.repeat(81) }, { evil: 1 }]) {
        await t.http.put('/api/admin/settings/shop').set(bearer(owner())).send({ ...ok, ...bad }).expect(400);
      }
    });
  });

  // ── list / detail ─────────────────────────────────────────────────────────
  describe('listing and detail', () => {
    it('lists orders newest first with the customer, and filters by status', async () => {
      const a = await customerWithOrder(t, shop, '9000000001');
      await customerWithOrder(t, shop, '9000000002');
      await submitReceiptOk(t, a);
      const all = (await get('/api/admin/orders').expect(200)).body;
      expect(all.total).toBe(2);
      expect(all.items[0]).toMatchObject({ phone: '+919000000002', status: 'PENDING_PAYMENT' });
      const q = (await get('/api/admin/orders?status=PAYMENT_SUBMITTED').expect(200)).body;
      expect(q.items.map((i: any) => i.order_no)).toEqual([a.order.order_no]);
      expect((await get('/api/admin/orders?status=BOGUS').expect(200)).body.total).toBe(0);
    });

    it('the verification queue is oldest-first (first come, first served)', async () => {
      const a = await submitted('9000000001');
      const b = await submitted('9000000002');
      const c = await submitted('9000000003');
      const items = (await get('/api/admin/orders?status=PAYMENT_SUBMITTED').expect(200)).body.items;
      expect(items.map((i: any) => i.order_no)).toEqual([a, b, c].map((x) => x.order.order_no));
    });

    it('searches by order number, phone digits, name and payment reference - and treats % and _ literally', async () => {
      const a = await submitted('9000000001', { utr: 'REF123456789' });
      await customerWithOrder(t, shop, '9000000002');
      const search = async (q: string) => (await get(`/api/admin/orders?q=${encodeURIComponent(q)}`).expect(200)).body.items.map((i: any) => i.order_no);
      expect(await search(a.order.order_no)).toEqual([a.order.order_no]);
      expect(await search('9000000001')).toEqual([a.order.order_no]);
      expect(await search('ref1234')).toEqual([a.order.order_no]);
      expect(await search('anaya')).toHaveLength(2);
      expect(await search('%')).toEqual([]);
      expect(await search("'; DROP TABLE orders;--")).toEqual([]);
      expect((await get('/api/admin/orders').expect(200)).body.total).toBe(2);
    });

    it('detail shows items, address, customer, payment claim, and the full event history', async () => {
      const c = await submitted('9876543210', { utr: 'AB12CD34EF56', paid_amount_paise: 285000 });
      const d = await detail(c.orderId);
      expect(d).toMatchObject({ order_no: c.order.order_no, status: 'PAYMENT_SUBMITTED', customer: { phone: '+919876543210' }, address: { city: 'Bengaluru' } });
      expect(d.payment).toMatchObject({ has_receipt: true, utr: 'AB12CD34EF56', claimed_amount_paise: 285000, expected_amount_paise: 285000, amount_mismatch: false, duplicate_utr_orders: [] });
      expect(d.events.map((e: any) => [e.from, e.to, e.actor])).toEqual([[null, 'PENDING_PAYMENT', 'customer'], ['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'customer']]);
    });

    it('404 for an unknown order, 400 for a malformed id', async () => {
      await get('/api/admin/orders/11111111-1111-4111-8111-111111111111').expect(404);
      await get('/api/admin/orders/not-a-uuid').expect(400);
    });

    it('serves the receipt only as a short-lived signed link into the private bucket, never cached', async () => {
      const c = await submitted();
      const res = await get(`/api/admin/orders/${c.orderId}/receipt-url`).expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.expires_in).toBe(300);
      const u = new URL(res.body.url);
      expect(u.host).toBe('smellme-private-test.testacct.r2.cloudflarestorage.com');
      expect(u.searchParams.get('X-Amz-Expires')).toBe('300');
      const pending = await customerWithOrder(t, shop, '9000000005');
      await get(`/api/admin/orders/${pending.orderId}/receipt-url`).expect(404);
    });

    it('summary counts what needs doing', async () => {
      await submitted('9000000001');
      await paid('9000000002');
      await customerWithOrder(t, shop, '9000000003');
      const s = (await get('/api/admin/orders/summary').expect(200)).body;
      expect(s).toMatchObject({ awaiting_verification: 1, to_pack: 1, refunds_due: 0, by_status: { PENDING_PAYMENT: 1, PAYMENT_SUBMITTED: 1, PAID: 1 } });
      expect(s.today).toMatchObject({ verified_orders: 1, verified_sales_paise: 285000 });
    });
  });

  // ── verifying payment ─────────────────────────────────────────────────────
  describe('approving payment', () => {
    it('moves PAYMENT_SUBMITTED to PAID, records who and when, and tells the customer on WhatsApp', async () => {
      const c = await submitted('9876543210', { paid_amount_paise: 285000 });
      const d = (await approve(c.orderId).expect(200)).body;
      expect(d.status).toBe('PAID');
      expect(d.payment.verified_at).toBeTruthy();
      const row = (await t.db.query('SELECT payment_verified_by FROM orders'))[0];
      expect(row.payment_verified_by).toBeTruthy();
      const ev = d.events.at(-1);
      expect(ev).toMatchObject({ from: 'PAYMENT_SUBMITTED', to: 'PAID', actor: 'admin' });
      await flush();
      expect(t.wa.sent.find((m) => m.templateId === 'payment_approved')).toMatchObject({ to: '919876543210', params: ['Anaya Rao', c.order.order_no] });
    });

    it('cannot approve an order that has no receipt submitted yet, or one already paid', async () => {
      const pending = await customerWithOrder(t, shop);
      await approve(pending.orderId).expect(409);
      const c = await submitted('9000000002');
      await approve(c.orderId).expect(200);
      await approve(c.orderId).expect(409);
    });

    it('two staff approving at once: one wins, one gets a clear conflict, one history row', async () => {
      const c = await submitted();
      const rs = await Promise.all([approve(c.orderId), approve(c.orderId), approve(c.orderId)]);
      expect(rs.map((r) => r.status).sort()).toEqual([200, 409, 409]);
      expect(await t.db.query("SELECT 1 FROM order_events WHERE to_status = 'PAID'")).toHaveLength(1);
      await flush();
      expect(t.wa.sent.filter((m) => m.templateId === 'payment_approved')).toHaveLength(1);
    });

    it('when the customer claims a different amount than the order total, approval needs an explicit confirmation', async () => {
      const c = await submitted('9876543210', { paid_amount_paise: 250000 });
      expect((await detail(c.orderId)).payment.amount_mismatch).toBe(true);
      const refused = await approve(c.orderId).expect(409);
      expect(refused.body.message).toMatch(/₹2,500.*₹2,850/);
      expect((await detail(c.orderId)).status).toBe('PAYMENT_SUBMITTED');
      await approve(c.orderId, { confirm_amount_mismatch: true }).expect(200);
      expect((await t.db.query("SELECT meta FROM order_events WHERE to_status = 'PAID'"))[0].meta).toMatchObject({ amount_mismatch_confirmed: true });
    });

    it('a payment reference already used on another live order needs an explicit confirmation too', async () => {
      const a = await submitted('9000000001', { utr: 'SAMEREF123456' });
      const b = await submitted('9000000002', { utr: 'SAMEREF123456' });
      expect((await detail(b.orderId)).payment.duplicate_utr_orders).toEqual([{ order_no: a.order.order_no, status: 'PAYMENT_SUBMITTED' }]);
      const refused = await approve(b.orderId).expect(409);
      expect(refused.body.message).toContain(a.order.order_no);
      await approve(a.orderId, { confirm_duplicate_utr: true }).expect(200);
      await approve(b.orderId, { confirm_duplicate_utr: true }).expect(200);
    });

    it('a cancelled order\'s reference no longer counts as a duplicate', async () => {
      const a = await submitted('9000000001', { utr: 'REUSEDREF1234' });
      await post(`/api/admin/orders/${a.orderId}/cancel`, { reason: 'test' }).expect(200);
      const b = await submitted('9000000002', { utr: 'REUSEDREF1234' });
      await approve(b.orderId).expect(200);
    });
  });

  describe('rejecting payment', () => {
    it('needs a reason, returns the order to PENDING_PAYMENT, shows the customer why, and keeps the rejected receipt in the history', async () => {
      const c = await submitted('9876543210', { utr: 'BADREF123456' });
      await post(`/api/admin/orders/${c.orderId}/reject-payment`, {}).expect(400);
      await post(`/api/admin/orders/${c.orderId}/reject-payment`, { reason: '  ' }).expect(400);
      const d = (await post(`/api/admin/orders/${c.orderId}/reject-payment`, { reason: 'Amount does not match' }).expect(200)).body;
      expect(d.status).toBe('PENDING_PAYMENT');
      expect(d.events.at(-1)).toMatchObject({ from: 'PAYMENT_SUBMITTED', to: 'PENDING_PAYMENT', note: 'Amount does not match' });
      expect(d.events.at(-1).meta.rejected_receipt_key).toMatch(/^receipts\//);
      const view = (await t.http.get(`/api/customer/orders/${c.order.order_no}`).set(bearer(c.token)).expect(200)).body;
      expect(view).toMatchObject({ status: 'PENDING_PAYMENT', payment_reject_reason: 'Amount does not match', can_upload_receipt: true });
      expect(view.payment.amount_paise).toBe(285000);
      await flush();
      expect(t.wa.sent.find((m) => m.templateId === 'payment_rejected')!.params).toEqual(['Anaya Rao', c.order.order_no, 'Amount does not match']);
    });

    it('the customer can then pay again and resubmit, and the old claim does not carry over', async () => {
      const c = await submitted('9876543210', { utr: 'FIRSTREF1234', paid_amount_paise: 100 });
      await post(`/api/admin/orders/${c.orderId}/reject-payment`, { reason: 'Wrong amount' }).expect(200);
      expect((await t.db.query('SELECT utr, paid_amount_paise FROM orders'))[0]).toEqual({ utr: null, paid_amount_paise: null });
      await submitReceiptOk(t, c, { utr: 'SECONDREF123', paid_amount_paise: 285000 });
      const d = await detail(c.orderId);
      expect(d.status).toBe('PAYMENT_SUBMITTED');
      expect(d.payment).toMatchObject({ utr: 'SECONDREF123', amount_mismatch: false, reject_reason: null });
      await approve(c.orderId).expect(200);
    });

    it('cannot reject an order that is not awaiting verification', async () => {
      const c = await paid();
      await post(`/api/admin/orders/${c.orderId}/reject-payment`, { reason: 'late' }).expect(409);
    });
  });

  // ── fulfilment ────────────────────────────────────────────────────────────
  describe('fulfilment', () => {
    it('shipping can NEVER happen before the payment is verified', async () => {
      const pending = await customerWithOrder(t, shop, '9000000001');
      const review = await submitted('9000000002');
      for (const c of [pending, review]) {
        await post(`/api/admin/orders/${c.orderId}/pack`).expect(409);
        await post(`/api/admin/orders/${c.orderId}/ship`, { carrier: 'DTDC', tracking_no: 'X1' }).expect(409);
        await post(`/api/admin/orders/${c.orderId}/deliver`).expect(409);
      }
      expect((await detail(pending.orderId)).status).toBe('PENDING_PAYMENT');
      expect((await detail(review.orderId)).status).toBe('PAYMENT_SUBMITTED');
    });

    it('PAID -> PACKED -> SHIPPED -> DELIVERED, in order only, with tracking and WhatsApp updates', async () => {
      const c = await paid('9876543210');
      await post(`/api/admin/orders/${c.orderId}/ship`, { carrier: 'DTDC', tracking_no: 'D123' }).expect(409); // not packed yet
      expect((await post(`/api/admin/orders/${c.orderId}/pack`).expect(200)).body.status).toBe('PACKED');
      await post(`/api/admin/orders/${c.orderId}/ship`, {}).expect(400);
      await post(`/api/admin/orders/${c.orderId}/ship`, { carrier: 'DTDC', tracking_no: '  ' }).expect(400);
      const shipped = (await post(`/api/admin/orders/${c.orderId}/ship`, { carrier: 'DTDC', tracking_no: 'D1234567' }).expect(200)).body;
      expect(shipped).toMatchObject({ status: 'SHIPPED', shipping: { carrier: 'DTDC', tracking_no: 'D1234567' } });
      const mine = (await t.http.get(`/api/customer/orders/${c.order.order_no}`).set(bearer(c.token))).body;
      expect(mine.shipping).toMatchObject({ carrier: 'DTDC', tracking_no: 'D1234567' });
      expect((await post(`/api/admin/orders/${c.orderId}/deliver`).expect(200)).body.status).toBe('DELIVERED');
      await post(`/api/admin/orders/${c.orderId}/deliver`).expect(409);
      await flush();
      expect(t.wa.sent.find((m) => m.templateId === 'shipped')!.params).toEqual(['Anaya Rao', c.order.order_no, 'DTDC', 'D1234567']);
      expect(t.wa.sent.find((m) => m.templateId === 'delivered')!.params).toEqual(['Anaya Rao', c.order.order_no]);
      expect((await detail(c.orderId)).events.map((e: any) => e.to)).toEqual(['PENDING_PAYMENT', 'PAYMENT_SUBMITTED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED']);
    });

    it('a shipped or delivered order can no longer be cancelled', async () => {
      const c = await paid();
      await post(`/api/admin/orders/${c.orderId}/pack`).expect(200);
      await post(`/api/admin/orders/${c.orderId}/ship`, { carrier: 'DTDC', tracking_no: 'D1' }).expect(200);
      await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'late' }).expect(409);
      await post(`/api/admin/orders/${c.orderId}/deliver`).expect(200);
      await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'late' }).expect(409);
      expect(await stockOf(t, shop.v.ml50)).toBe(9);
    });
  });

  // ── cancelling + refunds ──────────────────────────────────────────────────
  describe('cancelling and refunding', () => {
    it('cancelling before any payment returns stock and needs no refund', async () => {
      const c = await customerWithOrder(t, shop, '9876543210', [{ variant_id: shop.v.ml50, qty: 3 }]);
      expect(await stockOf(t, shop.v.ml50)).toBe(7);
      const d = (await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'Customer asked' }).expect(200)).body;
      expect(d).toMatchObject({ status: 'CANCELLED', cancel: { reason: 'Customer asked', by: 'admin', refund_due: false } });
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
    });

    it('cancelling after payment returns stock AND flags a refund; refunding records it once', async () => {
      const c = await paid();
      const d = (await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'Out of packaging' }).expect(200)).body;
      expect(d.cancel.refund_due).toBe(true);
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
      expect((await get('/api/admin/orders/summary')).body.refunds_due).toBe(1);
      await post(`/api/admin/orders/${c.orderId}/refund`, {}).expect(400);
      const r = (await post(`/api/admin/orders/${c.orderId}/refund`, { note: 'UPI refund ref 99887766' }).expect(200)).body;
      expect(r).toMatchObject({ status: 'REFUNDED', cancel: { refund_due: false, refund_note: 'UPI refund ref 99887766' } });
      await post(`/api/admin/orders/${c.orderId}/refund`, { note: 'again' }).expect(409);
      expect((await get('/api/admin/orders/summary')).body.refunds_due).toBe(0);
    });

    it('cannot refund an order that never needed one', async () => {
      const c = await customerWithOrder(t, shop);
      await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'x' }).expect(200);
      await post(`/api/admin/orders/${c.orderId}/refund`, { note: 'n' }).expect(409);
    });

    it('needs a reason, and tells the customer on WhatsApp', async () => {
      const c = await customerWithOrder(t, shop);
      await post(`/api/admin/orders/${c.orderId}/cancel`, {}).expect(400);
      await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'Out of stock' }).expect(200);
      await flush();
      expect(t.wa.sent.find((m) => m.templateId === 'cancelled')!.params).toEqual(['Anaya Rao', c.order.order_no, 'Out of stock']);
    });

    it('a customer and an admin cancelling at the same moment return the stock once', async () => {
      const c = await customerWithOrder(t, shop);
      const rs = await Promise.all([
        t.http.post(`/api/customer/orders/${c.order.order_no}/cancel`).set(bearer(c.token)),
        post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'x' }),
      ]);
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      expect(await stockOf(t, shop.v.ml50)).toBe(10);
    });

    it('an admin-cancelled order frees its coupon use and its stock ledger entries are traceable to the order', async () => {
      await post('/api/admin/coupons', { code: 'ONE', type: 'flat', value: 1000, max_uses: 1 });
      const c = await customerWithOrder(t, shop, '9876543210', undefined, { coupon_code: 'ONE' });
      await post(`/api/admin/orders/${c.orderId}/cancel`, { reason: 'x' }).expect(200);
      expect((await t.db.query("SELECT used_count FROM coupons WHERE code = 'ONE'"))[0].used_count).toBe(0);
      const back = await t.db.query("SELECT ref, note, admin_id FROM stock_ledger WHERE reason = 'return'");
      expect(back).toEqual([{ ref: c.order.order_no, note: 'Order cancelled', admin_id: expect.any(String) }]);
    });
  });

  // ── customers + whatsapp log ──────────────────────────────────────────────
  describe('customers and the WhatsApp log', () => {
    it('lists customers with their order counts and what they have actually paid', async () => {
      await paid('9000000001');
      await customerWithOrder(t, shop, '9000000002');
      const list = (await get('/api/admin/customers').expect(200)).body;
      const by = Object.fromEntries(list.items.map((c: any) => [c.phone, c]));
      expect(by['+919000000001']).toMatchObject({ orders_count: 1, total_spent_paise: 285000 });
      expect(by['+919000000002']).toMatchObject({ orders_count: 1, total_spent_paise: 0 });
      expect((await get('/api/admin/customers?q=9000000002').expect(200)).body.total).toBe(1);
    });

    it('logs every message with a masked number, and never an OTP', async () => {
      await paid('9876543210');
      await flush();
      const log = (await get('/api/admin/whatsapp/messages').expect(200)).body;
      expect(log.items.map((m: any) => m.event).sort()).toEqual(['order_placed', 'otp', 'payment_approved']);
      const text = JSON.stringify(log);
      expect(text).not.toContain('9876543210');
      expect(text).toContain('••••3210');
      expect(log.items.find((m: any) => m.event === 'otp').params).toEqual(['[redacted]']);
      expect((await get('/api/admin/whatsapp/messages?status=failed').expect(200)).body.total).toBe(0);
    });

    it('records a failed send as failed, with the reason', async () => {
      const c = await customerLogin(t, '9000000009');
      t.wa.failNext = true;
      await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.ml50, qty: 1 }] }).expect(201);
      await flush();
      const failed = (await get('/api/admin/whatsapp/messages?status=failed').expect(200)).body.items;
      expect(failed).toHaveLength(1);
      expect(failed[0]).toMatchObject({ event: 'order_placed', error: 'simulated outage' });
    });
  });
});
