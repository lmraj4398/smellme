import './utils/test-env';
import { buildApp, PASSWORD, refreshCookie, seedAdmin, TestApp, tokenFor } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';

describe('owner-managed logins', () => {
  let t: TestApp;
  let owner: { token: string; user: { id: string } };

  beforeEach(async () => {
    t = await buildApp();
    owner = await tokenFor(t, null, 'owner@smellme.test');
  });
  afterEach(() => t.close());

  const create = (body: object, token = owner.token) => t.http.post('/api/admin/logins').set(bearer(token)).send(body);
  const patch = (id: string, body: object, token = owner.token) => t.http.patch(`/api/admin/logins/${id}`).set(bearer(token)).send(body);
  const signIn = (email: string, password = PASSWORD) => t.http.post('/api/auth/login').send({ email, password });
  const newLogin = (over: object = {}) => ({ name: 'Content Editor', email: 'editor@smellme.test', password: PASSWORD, screens: ['content', 'products'], ...over });

  describe('access', () => {
    it('401 without a token', async () => {
      await t.http.get('/api/admin/logins').expect(401);
      await t.http.post('/api/admin/logins').send(newLogin()).expect(401);
    });

    it('403 for a restricted login, even one holding every screen', async () => {
      const everything = ['orders', 'products', 'inventory', 'customers', 'coupons', 'reviews', 'content', 'marketing', 'logs', 'settings'];
      const { token, user } = await tokenFor(t, everything);
      await t.http.get('/api/admin/logins').set(bearer(token)).expect(403);
      await create(newLogin(), token).expect(403);
      await patch(user.id, { name: 'x' }, token).expect(403);
      await t.http.post(`/api/admin/logins/${owner.user.id}/reset-password`).set(bearer(token)).send({ new_password: 'another-pass-99' }).expect(403);
    });

    it('lists logins with the valid screen keys, and never any password data', async () => {
      await seedAdmin(t.db, { email: 'b@smellme.test' });
      const res = await t.http.get('/api/admin/logins').set(bearer(owner.token)).expect(200);
      expect(res.body.screens).toContain('products');
      expect(res.body.items).toHaveLength(2);
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    });
  });

  describe('create', () => {
    it('creates a restricted login that can sign in and is held to its screens', async () => {
      const made = (await create(newLogin()).expect(201)).body;
      expect(made).toMatchObject({ email: 'editor@smellme.test', screens: ['content', 'products'], is_active: true });
      const { body } = await signIn('editor@smellme.test').expect(200);
      expect(body.user.screens).toEqual(['content', 'products']);
      await t.http.get('/api/admin/products').set(bearer(body.token)).expect(200);
      await t.http.get('/api/admin/inventory').set(bearer(body.token)).expect(403);
    });

    it('can create an unrestricted login (screens: null)', async () => {
      await create(newLogin({ email: 'b@smellme.test', screens: null })).expect(201);
      expect((await signIn('b@smellme.test').expect(200)).body.user.screens).toBeNull();
    });

    it('lower-cases the email and rejects a duplicate (409)', async () => {
      await create(newLogin({ email: 'Editor@SmellMe.Test' })).expect(201);
      await create(newLogin({ email: 'editor@smellme.test' })).expect(409);
    });

    it.each([
      ['unknown screen', { screens: ['orders', 'nuclear-codes'] }],
      ['duplicate screen', { screens: ['orders', 'orders'] }],
      ['screens missing', { screens: undefined }],
      ['weak password', { password: 'short1' }],
      ['bad email', { email: 'nope' }],
      ['smuggled field', { is_active: false, allowed_screens: null }],
    ])('400: %s', async (_n, over) => { await create(newLogin(over)).expect(400); });
  });

  describe('update', () => {
    let editor: { id: string };
    beforeEach(async () => { editor = (await create(newLogin()).expect(201)).body; });

    it('changes the screens, and ends that login\'s sessions so the change applies at once', async () => {
      const session = await signIn('editor@smellme.test');
      const cookie = refreshCookie(session)!;
      await patch(editor.id, { screens: ['orders'] }).expect(200);
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${cookie}`).expect(401);
      const again = (await signIn('editor@smellme.test').expect(200)).body;
      expect(again.user.screens).toEqual(['orders']);
      await t.http.get('/api/admin/products').set(bearer(again.token)).expect(403);
    });

    it('deactivating blocks sign-in and kills existing sessions', async () => {
      const cookie = refreshCookie(await signIn('editor@smellme.test'))!;
      await patch(editor.id, { is_active: false }).expect(200);
      await signIn('editor@smellme.test').expect(401);
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${cookie}`).expect(401);
      await patch(editor.id, { is_active: true }).expect(200);
      await signIn('editor@smellme.test').expect(200);
    });

    it('renaming alone does not sign anyone out', async () => {
      const cookie = refreshCookie(await signIn('editor@smellme.test'))!;
      await patch(editor.id, { name: 'Priya' }).expect(200);
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${cookie}`).expect(200);
    });

    it('can lift the restriction (screens: null)', async () => {
      await patch(editor.id, { screens: null }).expect(200);
      expect((await signIn('editor@smellme.test')).body.user.screens).toBeNull();
    });

    it('404 for an unknown login, 400 for a malformed id or bad screens', async () => {
      await patch('11111111-1111-4111-8111-111111111111', { name: 'x' }).expect(404);
      await patch('nope', { name: 'x' }).expect(400);
      await patch(editor.id, { screens: ['bogus'] }).expect(400);
    });

    it('the owner cannot restrict or deactivate their OWN login', async () => {
      await patch(owner.user.id, { screens: ['orders'] }).expect(400);
      await patch(owner.user.id, { is_active: false }).expect(400);
      await patch(owner.user.id, { name: 'Renamed' }).expect(200);
    });

    it('always keeps at least one active unrestricted login', async () => {
      const second = (await create(newLogin({ email: 'b@smellme.test', screens: null })).expect(201)).body;
      const b = (await signIn('b@smellme.test')).body.token;
      // b may demote the original owner while b remains unrestricted...
      await patch(owner.user.id, { screens: ['orders'] }, b).expect(200);
      // ...but then b is the last one and cannot be demoted (not even by... itself is blocked anyway).
      await patch(second.id, { is_active: false }, b).expect(400);
      // Another unrestricted login would be needed first.
      const c = (await create(newLogin({ email: 'c@smellme.test', screens: null }), b).expect(201)).body;
      await patch(c.id, { screens: ['orders'] }, b).expect(200);
      expect((await t.db.query('SELECT count(*)::int n FROM admin_users WHERE is_active AND allowed_screens IS NULL'))[0].n).toBe(1);
    });
  });

  describe('reset password', () => {
    it('sets a new password, ends their sessions, and the old password stops working', async () => {
      const editor = (await create(newLogin()).expect(201)).body;
      const cookie = refreshCookie(await signIn('editor@smellme.test'))!;
      await t.http.post(`/api/admin/logins/${editor.id}/reset-password`).set(bearer(owner.token)).send({ new_password: 'fresh-start-77' }).expect(200);
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${cookie}`).expect(401);
      await signIn('editor@smellme.test').expect(401);
      await signIn('editor@smellme.test', 'fresh-start-77').expect(200);
    });

    it('refuses weak passwords, unknown logins and resetting yourself', async () => {
      const editor = (await create(newLogin()).expect(201)).body;
      const reset = (id: string, pw: string) => t.http.post(`/api/admin/logins/${id}/reset-password`).set(bearer(owner.token)).send({ new_password: pw });
      await reset(editor.id, 'weak').expect(400);
      await reset('11111111-1111-4111-8111-111111111111', 'fresh-start-77').expect(404);
      await reset(owner.user.id, 'fresh-start-77').expect(400);
    });
  });
});
