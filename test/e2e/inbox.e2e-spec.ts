import './utils/test-env';
import { buildApp, TestApp, tokenFor } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';

describe('contact + newsletter', () => {
  let t: TestApp;
  let owner: string;
  beforeEach(async () => {
    t = await buildApp();
    owner = (await tokenFor(t, null)).token;
  });
  afterEach(() => t.close());

  const msg = (over: object = {}) => ({ name: 'Anaya', phone: '+91 98765 43210', email: 'anaya@example.com', topic: 'An order I placed', message: 'Where is my order?', ...over });
  const send = (over: object = {}) => t.http.post('/api/contact').send(msg(over));
  const rows = (table: string) => t.db.query(`SELECT * FROM ${table}`);

  describe('POST /contact (public)', () => {
    it('stores a message from an anonymous visitor', async () => {
      await send().expect(200);
      const [m] = await rows('contact_messages');
      expect(m).toMatchObject({ name: 'Anaya', email: 'anaya@example.com', topic: 'An order I placed', is_read: false });
    });

    it('accepts a phone only, or an email only, but not neither', async () => {
      await send({ email: undefined }).expect(200);
      await send({ phone: undefined }).expect(200);
      const res = await send({ phone: undefined, email: undefined }).expect(400);
      expect(res.body.message).toMatch(/phone number or an email/);
      expect(await rows('contact_messages')).toHaveLength(2);
    });

    it.each([
      ['empty name', { name: ' ' }],
      ['empty message', { message: '' }],
      ['huge message', { message: 'x'.repeat(3001) }],
      ['unknown topic', { topic: 'Free money' }],
      ['bad email', { email: 'nope' }],
      ['bad phone', { phone: 'call me maybe' }],
      ['smuggled field', { is_read: true }],
    ])('400: %s', async (_n, over) => {
      await send(over).expect(400);
      expect(await rows('contact_messages')).toHaveLength(0);
    });

    it('silently drops honeypot submissions (looks like success to the bot, stores nothing)', async () => {
      const res = await send({ website: 'http://spam.example' }).expect(200);
      expect(res.body).toEqual({ ok: true });
      expect(await rows('contact_messages')).toHaveLength(0);
    });

    it('stores markup as inert text and never executes or reflects it', async () => {
      const res = await send({ message: '<script>alert(1)</script>' }).expect(200);
      expect(JSON.stringify(res.body)).not.toContain('script');
      expect((await rows('contact_messages'))[0].message).toBe('<script>alert(1)</script>');
    });
  });

  describe('POST /newsletter (public)', () => {
    it('subscribes, lower-casing the address', async () => {
      await t.http.post('/api/newsletter').send({ email: 'Priya@Example.COM' }).expect(200);
      expect((await rows('newsletter_subscribers')).map((r: any) => r.email)).toEqual(['priya@example.com']);
    });

    it('is idempotent and gives the same answer for a new and an existing address', async () => {
      const a = await t.http.post('/api/newsletter').send({ email: 'a@example.com' }).expect(200);
      const b = await t.http.post('/api/newsletter').send({ email: 'A@example.com' }).expect(200);
      expect(b.body).toEqual(a.body);
      expect(await rows('newsletter_subscribers')).toHaveLength(1);
    });

    it('rejects bad addresses and ignores honeypot fills', async () => {
      await t.http.post('/api/newsletter').send({ email: 'nope' }).expect(400);
      await t.http.post('/api/newsletter').send({}).expect(400);
      await t.http.post('/api/newsletter').send({ email: 'bot@example.com', website: 'x' }).expect(200);
      expect(await rows('newsletter_subscribers')).toHaveLength(0);
    });
  });

  describe('admin inbox', () => {
    it('401 without a token and 403 without the "marketing" screen', async () => {
      await t.http.get('/api/admin/inbox/messages').expect(401);
      await t.http.get('/api/admin/inbox/subscribers').expect(401);
      const { token } = await tokenFor(t, ['content', 'orders']);
      await t.http.get('/api/admin/inbox/messages').set(bearer(token)).expect(403);
      await t.http.get('/api/admin/inbox/subscribers').set(bearer(token)).expect(403);
      await t.http.patch('/api/admin/inbox/messages/11111111-1111-4111-8111-111111111111').set(bearer(token)).send({ is_read: true }).expect(403);
    });

    it('lists newest first with an unread count, filters unread, and marks read/unread', async () => {
      await send({ name: 'First' }).expect(200);
      await send({ name: 'Second' }).expect(200);
      const list = (await t.http.get('/api/admin/inbox/messages').set(bearer(owner)).expect(200)).body;
      expect(list.items.map((m: any) => m.name)).toEqual(['Second', 'First']);
      expect(list.unread).toBe(2);

      const id = list.items[0].id;
      await t.http.patch(`/api/admin/inbox/messages/${id}`).set(bearer(owner)).send({ is_read: true }).expect(200);
      const unread = (await t.http.get('/api/admin/inbox/messages?unread=true').set(bearer(owner))).body;
      expect(unread.items.map((m: any) => m.name)).toEqual(['First']);
      expect(unread.unread).toBe(1);

      await t.http.patch(`/api/admin/inbox/messages/${id}`).set(bearer(owner)).send({ is_read: false }).expect(200);
      expect((await t.http.get('/api/admin/inbox/messages').set(bearer(owner))).body.unread).toBe(2);
    });

    it('404 for an unknown message, 400 for a malformed id or body', async () => {
      await t.http.patch('/api/admin/inbox/messages/11111111-1111-4111-8111-111111111111').set(bearer(owner)).send({ is_read: true }).expect(404);
      await t.http.patch('/api/admin/inbox/messages/nope').set(bearer(owner)).send({ is_read: true }).expect(400);
      await send().expect(200);
      const id = (await t.http.get('/api/admin/inbox/messages').set(bearer(owner))).body.items[0].id;
      await t.http.patch(`/api/admin/inbox/messages/${id}`).set(bearer(owner)).send({ is_read: 'yes' }).expect(400);
    });

    it('lists subscribers with paging', async () => {
      for (const e of ['a', 'b', 'c']) await t.http.post('/api/newsletter').send({ email: `${e}@example.com` }).expect(200);
      const p1 = (await t.http.get('/api/admin/inbox/subscribers?limit=2').set(bearer(owner)).expect(200)).body;
      expect(p1).toMatchObject({ total: 3 });
      expect(p1.items).toHaveLength(2);
      await t.http.get('/api/admin/inbox/subscribers?limit=501').set(bearer(owner)).expect(400);
    });
  });
});
