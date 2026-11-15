import './utils/test-env';
import { buildApp, customerLogin, TestApp, tokenFor } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';

const P = '9876543210';
const CANON = '+919876543210';

describe('customer sign-in (WhatsApp OTP)', () => {
  let t: TestApp;
  beforeEach(async () => { t = await buildApp(); });
  afterEach(() => t.close());

  const send = (phone: string = P) => t.http.post('/api/customer/otp/send').send({ phone });
  const verify = (code: string, phone: string = P, extra: object = {}) => t.http.post('/api/customer/otp/verify').send({ phone, code, ...extra });
  const wrong = (real: string) => (real === '000000' ? '111111' : '000000');
  // Skips the 30 s resend cooldown by back-dating the existing codes.
  const ageCodes = () => t.db.query("UPDATE customer_otps SET created_at = created_at - interval '1 minute'");

  describe('sending the code', () => {
    it('sends a 6-digit code to the number on WhatsApp, and never returns it to the caller', async () => {
      const res = await send().expect(200);
      expect(res.body).toEqual({ ok: true, expires_in: 300, resend_after: 30 });
      expect(t.wa.sent).toHaveLength(1);
      expect(t.wa.sent[0]).toMatchObject({ to: '919876543210', templateId: 'otp' });
      expect(t.wa.sent[0].params[0]).toMatch(/^\d{6}$/);
      expect(JSON.stringify(res.body)).not.toContain(t.wa.sent[0].params[0]);
    });

    it('accepts the usual ways of writing a number', async () => {
      for (const p of ['98765 43210', '+91 98765-43210', '09876543210']) { await send(p).expect(200); await ageCodes(); }
      expect(new Set(t.wa.sent.map((m) => m.to))).toEqual(new Set(['919876543210']));
    });

    it.each(['', '12345', '5876543210', '+1 415 555 2671', 'abcdefghij', '9876543210; DROP TABLE'])('400 for the invalid number %j', async (p) => {
      await send(p).expect(400);
      expect(t.wa.sent).toHaveLength(0);
    });

    it('answers identically for a number with an account and one without (no account enumeration)', async () => {
      const fresh = await send('9000000001').expect(200);
      await customerLogin(t, '9000000002');
      await ageCodes();
      const existing = await send('9000000002').expect(200);
      expect(existing.body).toEqual(fresh.body);
    });

    it('enforces a 30 s cooldown per phone with a retry_after', async () => {
      await send().expect(200);
      const res = await send().expect(429);
      expect(res.body.retry_after).toBeGreaterThan(0);
      expect(res.body.retry_after).toBeLessThanOrEqual(30);
      expect(t.wa.sent).toHaveLength(1);
      await send('9000000009').expect(200); // another number is unaffected
    });

    it('caps a phone at 3 codes per 10 minutes, even if the cooldown is respected', async () => {
      for (let i = 0; i < 3; i++) { await send().expect(200); await ageCodes(); }
      const res = await send().expect(429);
      expect(res.body.message).toMatch(/too many codes/i);
      expect(res.body.retry_after).toBeGreaterThan(0);
      expect(t.wa.sent).toHaveLength(3);
    });

    it('if WhatsApp is down: 503, no usable code is left behind, and they can retry straight away', async () => {
      t.wa.failNext = true;
      await send().expect(503);
      expect(await t.db.query('SELECT 1 FROM customer_otps')).toHaveLength(0);
      await send().expect(200); // not blocked by the cooldown
    });

    it('never stores or logs the code in plain text', async () => {
      await send().expect(200);
      const code = t.wa.sent[0].params[0];
      expect(JSON.stringify(await t.db.query('SELECT * FROM customer_otps'))).not.toContain(code);
      const log = await t.db.query('SELECT params, to_masked, status FROM whatsapp_messages');
      expect(log).toEqual([{ params: ['[redacted]'], to_masked: '+••••••••3210', status: 'sent' }]);
    });
  });

  describe('verifying the code', () => {
    it('signs in, creating the customer and setting an httpOnly cookie scoped to /api/customer', async () => {
      await send().expect(200);
      const res = await verify(t.wa.lastOtp(CANON)!, P, { name: 'Anaya' }).expect(200);
      expect(res.body.customer).toMatchObject({ phone: CANON, name: 'Anaya' });
      expect(res.body.token).toEqual(expect.any(String));
      const cookie = ([] as string[]).concat(res.headers['set-cookie'])[0];
      expect(cookie).toMatch(/^sm_crt=.*HttpOnly.*SameSite=Lax/is);
      expect(cookie).toMatch(/Path=\/api\/customer/);
      expect(JSON.stringify(res.body)).not.toContain(cookie.split(';')[0].slice(8));
    });

    it('a returning customer keeps their existing name', async () => {
      await customerLogin(t, P, 'Anaya');
      await ageCodes();
      await send().expect(200);
      const res = await verify(t.wa.lastOtp(CANON)!, P, { name: 'Someone else' }).expect(200);
      expect(res.body.customer.name).toBe('Anaya');
      expect(await t.db.query('SELECT 1 FROM customers')).toHaveLength(1);
    });

    it('a code works once only', async () => {
      await send().expect(200);
      const code = t.wa.lastOtp(CANON)!;
      await verify(code).expect(200);
      await verify(code).expect(400);
    });

    it('a wrong code, an expired code, and "no code requested" all get the SAME answer', async () => {
      const none = await verify('123456').expect(400);
      await send().expect(200);
      const code = t.wa.lastOtp(CANON)!;
      const bad = await verify(wrong(code)).expect(400);
      await t.db.query("UPDATE customer_otps SET expires_at = now() - interval '1 second'");
      const expired = await verify(code).expect(400);
      expect(bad.body.message).toBe(none.body.message);
      expect(expired.body.message).toBe(none.body.message);
    });

    it('a code for one number is useless for another', async () => {
      await send('9000000001').expect(200);
      const code = t.wa.lastOtp('+919000000001')!;
      await send('9000000002').expect(200);
      await verify(code, '9000000002').expect(400);
    });

    it('only the newest code is valid', async () => {
      await send().expect(200);
      const first = t.wa.lastOtp(CANON)!;
      await ageCodes();
      await send().expect(200);
      const second = t.wa.lastOtp(CANON)!;
      if (first !== second) await verify(first).expect(400);
      await verify(second).expect(200);
    });

    it('dies after 5 wrong guesses: even the CORRECT code is then refused', async () => {
      await send().expect(200);
      const code = t.wa.lastOtp(CANON)!;
      for (let i = 0; i < 5; i++) await verify(wrong(code)).expect(400);
      await verify(code).expect(400);
    });

    it('is safe against parallel guessing: 18 simultaneous wrong guesses use at most 5 attempts', async () => {
      await send().expect(200);
      const code = t.wa.lastOtp(CANON)!;
      const results = await Promise.all(Array.from({ length: 18 }, () => verify(wrong(code))));
      expect(results.every((r) => r.status === 400)).toBe(true);
      expect((await t.db.query('SELECT attempts FROM customer_otps'))[0].attempts).toBeLessThanOrEqual(5);
      await verify(code).expect(400); // and the code is now dead
    });

    it('is safe against replaying the correct code in parallel: exactly one session is created', async () => {
      await send().expect(200);
      const code = t.wa.lastOtp(CANON)!;
      const results = await Promise.all(Array.from({ length: 6 }, () => verify(code)));
      expect(results.filter((r) => r.status === 200)).toHaveLength(1);
      expect(await t.db.query('SELECT 1 FROM customers')).toHaveLength(1);
    });

    it.each([['letters', 'abcdef'], ['too short', '12345'], ['too long', '1234567'], ['empty', '']])('400 for a malformed code: %s', async (_n, c) => {
      await verify(c).expect(400);
    });
  });

  describe('sessions', () => {
    it('GET /customer/me needs a customer token', async () => {
      await t.http.get('/api/customer/me').expect(401);
      await t.http.get('/api/customer/me').set(bearer('garbage')).expect(401);
      const { token } = await customerLogin(t, P, 'Anaya');
      expect((await t.http.get('/api/customer/me').set(bearer(token)).expect(200)).body).toMatchObject({ phone: CANON, name: 'Anaya' });
    });

    it('a customer token cannot open admin routes, and an admin token cannot open customer routes', async () => {
      const { token } = await customerLogin(t);
      for (const url of ['/api/admin/products', '/api/admin/logins', '/api/auth/me']) {
        await t.http.get(url).set(bearer(token)).expect(401);
      }
      const admin = (await tokenFor(t, null)).token;
      await t.http.get('/api/customer/me').set(bearer(admin)).expect(401);
      await t.http.get('/api/customer/addresses').set(bearer(admin)).expect(401);
    });

    it('refresh rotates the cookie; replaying the old one fails and (after the grace window) ends the session', async () => {
      const { cookie } = await customerLogin(t);
      const r1 = await t.http.post('/api/customer/refresh').set('Cookie', `sm_crt=${cookie}`).expect(200);
      const c2 = ([] as string[]).concat(r1.headers['set-cookie'])[0].split(';')[0].slice(8);
      expect(c2).not.toBe(cookie);
      await t.http.post('/api/customer/refresh').set('Cookie', `sm_crt=${cookie}`).expect(401);
      await t.db.query("UPDATE customer_refresh_tokens SET revoked_at = now() - interval '1 hour' WHERE revoked_at IS NOT NULL");
      await t.http.post('/api/customer/refresh').set('Cookie', `sm_crt=${cookie}`).expect(401);
      await t.http.post('/api/customer/refresh').set('Cookie', `sm_crt=${c2}`).expect(401); // family revoked
    });

    it('refresh with no or junk cookie is 401; logout revokes', async () => {
      await t.http.post('/api/customer/refresh').expect(401);
      await t.http.post('/api/customer/refresh').set('Cookie', 'sm_crt=junk').expect(401);
      const { cookie } = await customerLogin(t);
      await t.http.post('/api/customer/logout').set('Cookie', `sm_crt=${cookie}`).expect(200);
      await t.http.post('/api/customer/refresh').set('Cookie', `sm_crt=${cookie}`).expect(401);
    });

    it('updates the profile; email is lower-cased and validated', async () => {
      const { token } = await customerLogin(t);
      const res = await t.http.patch('/api/customer/me').set(bearer(token)).send({ name: ' Anaya Rao ', email: 'ANAYA@Example.COM' }).expect(200);
      expect(res.body).toMatchObject({ name: 'Anaya Rao', email: 'anaya@example.com' });
      await t.http.patch('/api/customer/me').set(bearer(token)).send({ email: 'nope' }).expect(400);
      await t.http.patch('/api/customer/me').set(bearer(token)).send({ phone: '+919999999999' }).expect(400); // the phone is the identity
    });
  });

  describe('saved addresses', () => {
    const addr = (over: object = {}) => ({ name: 'Anaya', phone: '98765 43210', line1: '12 MG Road', city: 'Bengaluru', state: 'Karnataka', pincode: '560001', ...over });

    it('creates (first one becomes the default), lists, updates and deletes', async () => {
      const { token } = await customerLogin(t);
      const a = (await t.http.post('/api/customer/addresses').set(bearer(token)).send(addr({ label: 'Home' })).expect(201)).body;
      expect(a).toMatchObject({ phone: CANON, is_default: true, label: 'Home' });
      const b = (await t.http.post('/api/customer/addresses').set(bearer(token)).send(addr({ line1: 'Office' })).expect(201)).body;
      expect(b.is_default).toBe(false);
      await t.http.put(`/api/customer/addresses/${b.id}`).set(bearer(token)).send(addr({ line1: 'Office', is_default: true })).expect(200);
      const list = (await t.http.get('/api/customer/addresses').set(bearer(token)).expect(200)).body;
      expect(list.map((x: any) => [x.line1, x.is_default])).toEqual([['Office', true], ['12 MG Road', false]]);
      await t.http.delete(`/api/customer/addresses/${a.id}`).set(bearer(token)).expect(200);
      expect((await t.http.get('/api/customer/addresses').set(bearer(token))).body).toHaveLength(1);
    });

    it("another customer can never see, change or delete someone else's address (404, nothing changes)", async () => {
      const alice = await customerLogin(t, '9000000001');
      const bob = await customerLogin(t, '9000000002');
      const a = (await t.http.post('/api/customer/addresses').set(bearer(alice.token)).send(addr()).expect(201)).body;
      expect((await t.http.get('/api/customer/addresses').set(bearer(bob.token))).body).toEqual([]);
      await t.http.put(`/api/customer/addresses/${a.id}`).set(bearer(bob.token)).send(addr({ line1: 'hijacked' })).expect(404);
      await t.http.delete(`/api/customer/addresses/${a.id}`).set(bearer(bob.token)).expect(404);
      const mine = (await t.http.get('/api/customer/addresses').set(bearer(alice.token))).body;
      expect(mine).toHaveLength(1);
      expect(mine[0].line1).toBe('12 MG Road');
    });

    it.each([
      ['unknown state', { state: 'Atlantis' }],
      ['bad pincode', { pincode: '056001' }],
      ['short pincode', { pincode: '5600' }],
      ['bad phone', { phone: '12345' }],
      ['empty street', { line1: '' }],
      ['smuggled owner', { customer_id: 'x' }],
    ])('400: %s', async (_n, over) => {
      const { token } = await customerLogin(t);
      await t.http.post('/api/customer/addresses').set(bearer(token)).send(addr(over)).expect(400);
    });

    it('allows at most 10 saved addresses', async () => {
      const { token } = await customerLogin(t);
      for (let i = 0; i < 10; i++) await t.http.post('/api/customer/addresses').set(bearer(token)).send(addr({ line1: `Street ${i}` })).expect(201);
      await t.http.post('/api/customer/addresses').set(bearer(token)).send(addr()).expect(400);
    });

    it('401 without a token', async () => {
      await t.http.get('/api/customer/addresses').expect(401);
      await t.http.post('/api/customer/addresses').send(addr()).expect(401);
    });
  });
});
