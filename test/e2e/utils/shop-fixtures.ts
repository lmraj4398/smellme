import { TestApp, tokenFor, customerLogin } from './build-app';
import { bearer, createProduct, productPayload, seedRefs, Refs } from './catalog-fixtures';
import { randomUUID } from 'crypto';

export interface Shop {
  owner: string;
  refs: Refs;
  /** variant ids by short name */
  v: { sample: string; ml50: string; ml100: string; rose: string; roseSample: string };
  productIds: { saffron: string; rose: string };
}

/**
 * A small catalogue with known prices and stock:
 *   Saffron Dusk  2 ml sample ₹190 (stock 5) | 50 ml ₹2,850 (stock 10) | 100 ml ₹4,450 (stock 2)
 *   Rose Velours  2 ml sample ₹130 (stock 4) | 12 ml ₹1,450 (stock 3)
 * Also sets the UPI address (owner-only setting) so orders can show payment instructions.
 */
export async function seedShop(t: TestApp): Promise<Shop> {
  const owner = (await tokenFor(t, null)).token;
  const refs = await seedRefs(t);
  const saffron = await createProduct(t, owner, productPayload(refs, {
    name: 'Saffron Dusk', media: [],
    variants: [
      { label: '2 ml sample', size_ml: 2, price_paise: 19000, is_sample: true, stock: 5 },
      { label: '50 ml', size_ml: 50, price_paise: 285000, stock: 10 },
      { label: '100 ml', size_ml: 100, price_paise: 445000, stock: 2 },
    ],
  }));
  const rose = await createProduct(t, owner, productPayload(refs, {
    name: 'Rose Velours', media: [],
    variants: [
      { label: '2 ml sample', size_ml: 2, price_paise: 13000, is_sample: true, stock: 4 },
      { label: '12 ml', size_ml: 12, price_paise: 145000, stock: 3 },
    ],
  }));
  const id = (p: { variants: { id: string; size_ml: number }[] }, ml: number) => p.variants.find((x) => x.size_ml === ml)!.id;
  await t.http.put('/api/admin/settings/payment').set(bearer(owner)).send({ upi_vpa: 'smellme@okhdfcbank', upi_payee_name: 'SmellMe' }).expect(200);
  return {
    owner, refs,
    v: { sample: id(saffron, 2), ml50: id(saffron, 50), ml100: id(saffron, 100), rose: id(rose, 12), roseSample: id(rose, 2) },
    productIds: { saffron: saffron.id, rose: rose.id },
  };
}

export const ADDRESS = { name: 'Anaya Rao', phone: '98765 43210', line1: '12 MG Road', line2: 'Near the park', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' };

export const stockOf = async (t: TestApp, variantId: string): Promise<number> => (await t.db.query('SELECT stock FROM product_variants WHERE id = $1', [variantId]))[0].stock;

/** POST /customer/orders for a signed-in customer. Returns the supertest response. */
export function placeOrder(t: TestApp, token: string, over: Record<string, unknown> = {}) {
  return t.http.post('/api/customer/orders').set(bearer(token)).send({ client_ref: randomUUID(), address: ADDRESS, ...over });
}

/** A customer who has placed one order (50 ml x1 by default). */
export async function customerWithOrder(t: TestApp, shop: Shop, phone = '9876543210', lines?: { variant_id: string; qty: number }[], extra: Record<string, unknown> = {}) {
  const c = await customerLogin(t, phone, 'Anaya');
  const res = await placeOrder(t, c.token, { lines: lines ?? [{ variant_id: shop.v.ml50, qty: 1 }], ...extra }).expect(201);
  return { ...c, order: res.body as { order_no: string; status: string; totals: { total_paise: number } & Record<string, number> }, orderId: (await t.db.query('SELECT id FROM orders ORDER BY order_seq DESC LIMIT 1'))[0].id as string };
}

/** Moves an order through the customer's receipt upload so it is ready for admin verification. */
export async function submitReceipt(t: TestApp, c: { token: string; order: { order_no: string }; orderId: string }, extra: Record<string, unknown> = {}) {
  const pre = await t.http.post(`/api/customer/orders/${c.order.order_no}/receipt/presign`).set(bearer(c.token)).send({ content_type: 'image/png', size: 2048 }).expect(200);
  t.storage.simulateUpload(pre.body.key, 'image/png', 2048);
  return t.http.post(`/api/customer/orders/${c.order.order_no}/receipt`).set(bearer(c.token)).send({ key: pre.body.key, ...extra });
}

/** Like submitReceipt, but fails the test unless the submission succeeds. Returns the response. */
export async function submitReceiptOk(t: TestApp, c: { token: string; order: { order_no: string }; orderId: string }, extra: Record<string, unknown> = {}) {
  const res = await submitReceipt(t, c, extra);
  if (res.status !== 200) throw new Error(`receipt submission failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res;
}
