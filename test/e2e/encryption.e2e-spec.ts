// A key and "require encrypted bodies" are set BEFORE the app is imported.
import './utils/test-env';
process.env.API_ENCRYPTION_KEY = 'ab'.repeat(32);
process.env.API_REQUIRE_ENCRYPTED_BODY = 'true';

import { encrypt, decrypt } from '../../src/common/crypto/aes';
import { buildApp, PASSWORD, seedAdmin, TestApp } from './utils/build-app';

const EMAIL = 'owner@smellme.test';
const body = (o: object) => encrypt(JSON.stringify(o));
const plain = (res: { body: unknown }) => JSON.parse(decrypt(res.body as ReturnType<typeof encrypt>));

describe('API encryption', () => {
  let t: TestApp;
  beforeEach(async () => {
    t = await buildApp();
  });
  afterEach(() => t.close());

  it('logs in with an encrypted body and answers with an encrypted envelope', async () => {
    await seedAdmin(t.db);
    const res = await t.http.post('/api/auth/login').send(body({ email: EMAIL, password: PASSWORD })).expect(200);
    expect(res.body).toEqual({ data: expect.any(String), iv: expect.any(String), ts: expect.any(Number) });
    expect(JSON.stringify(res.body)).not.toContain(EMAIL);
    const out = plain(res);
    expect(out.token).toEqual(expect.any(String));
    expect(out.user.email).toBe(EMAIL);
  });

  it('refuses a plaintext JSON body on a write', async () => {
    await seedAdmin(t.db);
    const res = await t.http.post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(400);
    expect(plain(res).message).toMatch(/encrypted payload required/i);
  });

  it('refuses a request outside the replay window', async () => {
    await seedAdmin(t.db);
    const stale = { ...body({ email: EMAIL, password: PASSWORD }), ts: Date.now() - 10 * 60 * 1000 };
    const res = await t.http.post('/api/auth/login').send(stale).expect(400);
    expect(plain(res).message).toMatch(/expired|replayed/i);
  });

  it('refuses a tampered ciphertext', async () => {
    const good = body({ email: EMAIL, password: PASSWORD });
    const buf = Buffer.from(good.data, 'base64');
    buf[0] ^= 0xff;
    const res = await t.http.post('/api/auth/login').send({ ...good, data: buf.toString('base64') }).expect(400);
    expect(plain(res).message).toMatch(/invalid encrypted payload/i);
  });

  it('still allows bodiless writes (refresh/logout) and leaves /health plain for monitors', async () => {
    await t.http.post('/api/auth/logout').expect(200);
    const h = await t.http.get('/api/health').expect(200);
    expect(h.body.status).toBe('ok');
  });

  it('encrypts error responses too', async () => {
    const res = await t.http.get('/api/auth/me').expect(401);
    expect(plain(res).statusCode).toBe(401);
  });
});
