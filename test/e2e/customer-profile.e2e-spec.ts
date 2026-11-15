import './utils/test-env';
import { buildApp, customerLogin, TestApp } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';
import { placeOrder, seedShop, Shop } from './utils/shop-fixtures';

describe('customer profile', () => {
  let t: TestApp;
  beforeEach(async () => { t = await buildApp(); });
  afterEach(() => t.close());

  const patch = (token: string, body: object) => t.http.patch('/api/customer/me').set(bearer(token)).send(body);
  const me = async (token: string) => (await t.http.get('/api/customer/me').set(bearer(token)).expect(200)).body;

  describe('birthday', () => {
    it('is empty to start with', async () => {
      const c = await customerLogin(t);
      expect((await me(c.token)).birthday).toBeNull();
      expect(c.customer).toMatchObject({ phone: '+919876543210' });
    });

    it('can be saved, read back, and removed', async () => {
      const c = await customerLogin(t);
      expect((await patch(c.token, { birthday: '1994-08-21' }).expect(200)).body.birthday).toBe('1994-08-21');
      expect((await me(c.token)).birthday).toBe('1994-08-21');
      expect((await patch(c.token, { birthday: '' }).expect(200)).body.birthday).toBeNull();
      expect((await me(c.token)).birthday).toBeNull();
    });

    it('is left alone when a request does not mention it', async () => {
      const c = await customerLogin(t);
      await patch(c.token, { birthday: '1994-08-21' }).expect(200);
      expect((await patch(c.token, { name: 'Anaya Rao' }).expect(200)).body).toMatchObject({ name: 'Anaya Rao', birthday: '1994-08-21' });
    });

    it.each(['21-08-1994', '1994/08/21', '1994-8-21', 'yesterday', '1994-13-01', '1994-02-30', '1899-12-31', '2999-01-01', '1994-08-21T00:00:00Z'])(
      'refuses %j',
      async (birthday) => {
        const c = await customerLogin(t);
        await patch(c.token, { birthday }).expect(400);
        expect((await me(c.token)).birthday).toBeNull();
      },
    );

    it('needs a customer login', async () => {
      await t.http.patch('/api/customer/me').send({ birthday: '1994-08-21' }).expect(401);
    });

    it('is shown to the owner on the customers list, with the date and nothing else extra', async () => {
      const shop = await seedShop(t);
      const c = await customerLogin(t, '9876543210', 'Anaya Rao');
      await patch(c.token, { birthday: '1994-08-21' }).expect(200);
      const list = (await t.http.get('/api/admin/customers').set(bearer(shop.owner)).expect(200)).body;
      expect(list.items[0]).toMatchObject({ name: 'Anaya Rao', birthday: '1994-08-21' });
    });
  });

  describe('scent profile', () => {
    let shop: Shop;
    beforeEach(async () => { shop = await seedShop(t); });
    const profile = async (token: string) => (await t.http.get('/api/customer/me/scent-profile').set(bearer(token)).expect(200)).body;

    it('needs a customer login', async () => {
      await t.http.get('/api/customer/me/scent-profile').expect(401);
      await t.http.get('/api/customer/me/scent-profile').set(bearer(shop.owner)).expect(401);
    });

    it('is empty before the first order', async () => {
      const c = await customerLogin(t);
      expect(await profile(c.token)).toEqual({ families: [] });
    });

    it('ranks the families a customer buys, most-bought first, relative to their top one', async () => {
      const woody = (await t.db.query("INSERT INTO scent_families (name, slug) VALUES ('Woody', 'woody') RETURNING id"))[0].id;
      await t.db.query('UPDATE products SET family_id = $1 WHERE id = $2', [woody, shop.productIds.rose]);
      const c = await customerLogin(t);
      await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.ml50, qty: 2 }, { variant_id: shop.v.rose, qty: 1 }] }).expect(201);
      expect(await profile(c.token)).toEqual({
        families: [{ name: 'Amber', slug: 'amber', qty: 2, share: 1 }, { name: 'Woody', slug: 'woody', qty: 1, share: 0.5 }],
      });
    });

    it('ignores cancelled orders and free samples, and other customers', async () => {
      const c = await customerLogin(t);
      const other = await customerLogin(t, '9000000002');
      await placeOrder(t, other.token, { lines: [{ variant_id: shop.v.ml50, qty: 1 }] }).expect(201);
      await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.ml50, qty: 1 }] }).expect(201);
      await t.db.query("UPDATE orders SET status = 'CANCELLED' WHERE customer_id = $1", [c.customer.id]);
      expect(await profile(c.token)).toEqual({ families: [] });
      await placeOrder(t, c.token, { lines: [{ variant_id: shop.v.rose, qty: 1 }] }).expect(201);
      await t.db.query('UPDATE order_items SET is_free_sample = true WHERE order_id IN (SELECT id FROM orders WHERE customer_id = $1 AND status <> $2)', [c.customer.id, 'CANCELLED']);
      expect(await profile(c.token)).toEqual({ families: [] });
    });
  });
});
