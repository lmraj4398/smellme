import './utils/test-env';
import { Controller, Get } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Screen } from '../../src/common/decorators/screen.decorator';
import { Public } from '../../src/common/decorators/public.decorator';
import { buildApp, PASSWORD, refreshCookie, seedAdmin, TestApp } from './utils/build-app';

// Probe routes, only for these tests: one guarded by a screen, one plain, one public.
@Controller('probe')
class ProbeController {
  @Screen('orders') @Get('orders') orders() { return { ok: 'orders' }; }
  @Get('any') any() { return { ok: 'any' }; }
  @Public() @Get('open') open() { return { ok: 'open' }; }
}

const EMAIL = 'owner@smellme.test';
const login = (t: TestApp, body: object = { email: EMAIL, password: PASSWORD }) =>
  t.http.post('/api/auth/login').send(body);

describe('auth', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await buildApp([ProbeController]);
  });
  afterEach(() => t.close());

  describe('login', () => {
    it('signs in, returns an access token and the user without any password data', async () => {
      await seedAdmin(t.db);
      const res = await login(t).expect(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toEqual({ id: expect.any(String), name: 'Owner', email: EMAIL, screens: null });
      expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
    });

    it('puts the refresh token in an httpOnly, path-scoped cookie and never in the body', async () => {
      await seedAdmin(t.db);
      const res = await login(t).expect(200);
      const cookie = ([] as string[]).concat(res.headers['set-cookie'])[0];
      expect(cookie).toMatch(/^sm_rt=/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(JSON.stringify(res.body)).not.toContain(refreshCookie(res)!);
    });

    it('is case-insensitive on the email', async () => {
      await seedAdmin(t.db);
      await login(t, { email: 'OWNER@SmellMe.Test', password: PASSWORD }).expect(200);
    });

    it('gives the SAME 401 for a wrong password, an unknown email and a disabled account', async () => {
      await seedAdmin(t.db);
      await seedAdmin(t.db, { email: 'off@smellme.test', is_active: false });
      const wrong = await login(t, { email: EMAIL, password: 'nope-nope-1' }).expect(401);
      const unknown = await login(t, { email: 'who@smellme.test', password: PASSWORD }).expect(401);
      const disabled = await login(t, { email: 'off@smellme.test', password: PASSWORD }).expect(401);
      for (const r of [unknown, disabled]) expect(r.body.message).toBe(wrong.body.message);
    });

    it('rejects malformed bodies (400) and extra fields', async () => {
      await login(t, { email: 'not-an-email', password: 'x' }).expect(400);
      await login(t, { email: EMAIL }).expect(400);
      await login(t, { email: EMAIL, password: 'x', role: 'OWNER' }).expect(400);
    });

    it('locks out an IP after 5 failed attempts with a retry_after, but a success never counts', async () => {
      await seedAdmin(t.db);
      for (let i = 0; i < 3; i++) await login(t).expect(200); // successes are not counted
      for (let i = 0; i < 5; i++) await login(t, { email: EMAIL, password: 'bad-bad-bad-1' }).expect(401);
      const res = await login(t, { email: EMAIL, password: 'bad-bad-bad-1' }).expect(429);
      expect(res.body.retry_after).toBeGreaterThan(0);
      // Even the right password is refused while locked: that is the point of a lockout.
      await login(t).expect(429);
    });
  });

  describe('deny by default', () => {
    it('401 with no token, a malformed header, or garbage', async () => {
      await t.http.get('/api/auth/me').expect(401);
      await t.http.get('/api/auth/me').set('Authorization', 'Token abc').expect(401);
      await t.http.get('/api/auth/me').set('Authorization', 'Bearer garbage').expect(401);
      await t.http.get('/api/probe/any').expect(401);
    });

    it('leaves @Public() routes and /health open', async () => {
      await t.http.get('/api/probe/open').expect(200);
      await t.http.get('/api/health').expect(200);
    });

    it('401 for a token signed with the wrong secret, an expired token, alg=none and a customer-type token', async () => {
      const u = await seedAdmin(t.db);
      const payload = { sub: u.id, typ: 'admin', screens: null };
      const wrongSecret = new JwtService({ secret: 'x'.repeat(40) }).sign(payload);
      const expired = new JwtService({ secret: process.env.JWT_SECRET }).sign(payload, { expiresIn: -10 });
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64(payload)}.`;
      const customer = new JwtService({ secret: process.env.JWT_SECRET }).sign({ ...payload, typ: 'customer' });
      for (const tok of [wrongSecret, expired, none, customer]) {
        await t.http.get('/api/auth/me').set('Authorization', `Bearer ${tok}`).expect(401);
      }
    });

    it('/auth/me works with a valid token', async () => {
      await seedAdmin(t.db);
      const { token } = (await login(t)).body;
      const me = await t.http.get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(me.body.email).toBe(EMAIL);
    });

    it('401 on /auth/me once the account is disabled', async () => {
      const u = await seedAdmin(t.db);
      const { token } = (await login(t)).body;
      await t.db.query('UPDATE admin_users SET is_active = false WHERE id = $1', [u.id]);
      await t.http.get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });

  describe('screen restriction', () => {
    const tokenFor = async (screens: string[] | null) => {
      await seedAdmin(t.db, { allowed_screens: screens });
      return (await login(t)).body.token as string;
    };

    it('an unrestricted login (owner) reaches every screen', async () => {
      const token = await tokenFor(null);
      await t.http.get('/api/probe/orders').set('Authorization', `Bearer ${token}`).expect(200);
    });

    it('a login limited to other screens gets 403 on this one', async () => {
      const token = await tokenFor(['products']);
      await t.http.get('/api/probe/orders').set('Authorization', `Bearer ${token}`).expect(403);
    });

    it('a login limited to this screen gets in, and un-tagged routes stay open to any admin', async () => {
      const token = await tokenFor(['orders']);
      await t.http.get('/api/probe/orders').set('Authorization', `Bearer ${token}`).expect(200);
      await t.http.get('/api/probe/any').set('Authorization', `Bearer ${token}`).expect(200);
    });

    it('a forged token cannot widen its own screens', async () => {
      const u = await seedAdmin(t.db, { allowed_screens: ['products'] });
      const forged = new JwtService({ secret: 'y'.repeat(40) }).sign({ sub: u.id, typ: 'admin', screens: null });
      await t.http.get('/api/probe/orders').set('Authorization', `Bearer ${forged}`).expect(401);
    });
  });

  describe('refresh', () => {
    it('rotates: returns a new access token and a different cookie', async () => {
      await seedAdmin(t.db);
      const first = await login(t);
      const c1 = refreshCookie(first)!;
      const second = await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c1}`).expect(200);
      expect(second.body.token).toEqual(expect.any(String));
      expect(refreshCookie(second)).toBeTruthy();
      expect(refreshCookie(second)).not.toBe(c1);
    });

    it('401 without a cookie or with an unknown one, and clears the cookie', async () => {
      await t.http.post('/api/auth/refresh').expect(401);
      const res = await t.http.post('/api/auth/refresh').set('Cookie', 'sm_rt=nonsense').expect(401);
      expect(([] as string[]).concat(res.headers['set-cookie'])[0]).toMatch(/sm_rt=;/);
    });

    it('a replayed old token fails; replayed after the grace window it also kills the new session', async () => {
      await seedAdmin(t.db);
      const c1 = refreshCookie(await login(t))!;
      const rotated = await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c1}`).expect(200);
      const c2 = refreshCookie(rotated)!;

      // Immediately (inside the grace window): refused, but the legit new token survives.
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c1}`).expect(401);
      const ok = await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c2}`).expect(200);
      const c3 = refreshCookie(ok)!;

      // Pretend c1 was revoked long ago, then replay it: theft assumed, whole family revoked.
      // Back-date ONLY c1 (the oldest row); c3's row stays active so only family revocation can kill it.
      await t.db.query(
        "UPDATE admin_refresh_tokens SET revoked_at = now() - interval '1 hour' " +
          'WHERE id = (SELECT id FROM admin_refresh_tokens ORDER BY created_at ASC LIMIT 1)',
      );
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c1}`).expect(401);
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c3}`).expect(401);
    });

    it('rejects an expired refresh token', async () => {
      await seedAdmin(t.db);
      const c = refreshCookie(await login(t))!;
      await t.db.query("UPDATE admin_refresh_tokens SET expires_at = now() - interval '1 minute'");
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c}`).expect(401);
    });

    it('refuses to refresh for a disabled account', async () => {
      const u = await seedAdmin(t.db);
      const c = refreshCookie(await login(t))!;
      await t.db.query('UPDATE admin_users SET is_active = false WHERE id = $1', [u.id]);
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c}`).expect(401);
    });

    it('only one of two simultaneous refreshes with the same token wins', async () => {
      await seedAdmin(t.db);
      const c = refreshCookie(await login(t))!;
      const [a, b] = await Promise.all([
        t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c}`),
        t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c}`),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 401]);
    });

    it('stores only a hash of the token', async () => {
      await seedAdmin(t.db);
      const c = refreshCookie(await login(t))!;
      const rows = await t.db.query('SELECT token_hash FROM admin_refresh_tokens');
      expect(rows).toHaveLength(1);
      expect(rows[0].token_hash).not.toContain(c);
      expect(rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      await seedAdmin(t.db);
      const c = refreshCookie(await login(t))!;
      const out = await t.http.post('/api/auth/logout').set('Cookie', `sm_rt=${c}`).expect(200);
      expect(([] as string[]).concat(out.headers['set-cookie'])[0]).toMatch(/sm_rt=;/);
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${c}`).expect(401);
    });

    it('is harmless without a cookie', async () => {
      await t.http.post('/api/auth/logout').expect(200);
    });
  });

  describe('change password', () => {
    const NEW = 'brand-new-pass-77';
    const auth = async () => {
      await seedAdmin(t.db);
      const res = await login(t);
      return { token: res.body.token as string, cookie: refreshCookie(res)! };
    };

    it('401 without a token', async () => {
      await t.http.post('/api/auth/change-password').send({ current_password: PASSWORD, new_password: NEW }).expect(401);
    });

    it('rejects a wrong current password and leaves the old one working', async () => {
      const { token } = await auth();
      await t.http.post('/api/auth/change-password').set('Authorization', `Bearer ${token}`)
        .send({ current_password: 'wrong-wrong-1', new_password: NEW }).expect(401);
      await login(t).expect(200);
    });

    it.each([
      ['too short', 'abc123'],
      ['no digit', 'only-letters-here'],
      ['no letter', '1234567890123'],
      ['over 72 chars', 'a1'.repeat(40)],
    ])('rejects a weak new password: %s', async (_n, pw) => {
      const { token } = await auth();
      await t.http.post('/api/auth/change-password').set('Authorization', `Bearer ${token}`)
        .send({ current_password: PASSWORD, new_password: pw }).expect(400);
    });

    it('changes the password, signs out other devices and keeps this one signed in', async () => {
      const { token, cookie: other } = await auth();
      const res = await t.http.post('/api/auth/change-password').set('Authorization', `Bearer ${token}`)
        .send({ current_password: PASSWORD, new_password: NEW }).expect(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(refreshCookie(res)).toBeTruthy();

      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${other}`).expect(401); // other device out
      await t.http.post('/api/auth/refresh').set('Cookie', `sm_rt=${refreshCookie(res)}`).expect(200); // this one in
      await login(t).expect(401); // old password dead
      await login(t, { email: EMAIL, password: NEW }).expect(200);
    });
  });

  describe('error logging', () => {
    it('records failures without leaking passwords into the log', async () => {
      await seedAdmin(t.db);
      await login(t, { email: EMAIL, password: 'super-secret-guess-1' }).expect(401);
      await new Promise((r) => setTimeout(r, 300)); // the log write is fire-and-forget
      const rows = await t.db.query('SELECT status_code, request_body FROM api_error_logs');
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain('super-secret-guess-1');
      expect(rows[0].request_body).toContain('[redacted]');
    });
  });
});
