import './utils/test-env';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildApp, TestApp } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';

// db-scripts/sample-admin-users.sql is run by hand on dev databases. This proves it still works with the real login:
// every password written in its header signs in, and each login gets exactly the screens the header promises.
const SQL = readFileSync(join(__dirname, '..', '..', 'db-scripts', 'sample-admin-users.sql'), 'utf8');

const USERS = [
  { email: 'owner@smellme.test', password: 'Owner-Pass-2026', screens: null },
  { email: 'orders@smellme.test', password: 'Orders-Pass-2026', screens: ['orders', 'customers', 'reviews'] },
  { email: 'catalog@smellme.test', password: 'Catalog-Pass-2026', screens: ['products', 'inventory', 'content'] },
  { email: 'support@smellme.test', password: 'Support-Pass-2026', screens: ['marketing', 'reviews', 'logs'] },
];

describe('db-scripts/sample-admin-users.sql', () => {
  let t: TestApp;
  beforeEach(async () => { t = await buildApp(); await t.db.query(SQL); });
  afterEach(() => t.close());

  const login = (email: string, password: string) => t.http.post('/api/auth/login').send({ email, password });

  it.each(USERS)('lets $email sign in with the password in the file, with the right screens', async ({ email, password, screens }) => {
    const res = await login(email, password).expect(200);
    expect(res.body.user).toMatchObject({ email, screens });
  });

  it('refuses a wrong password', async () => {
    await login('owner@smellme.test', 'Not-The-Password-1').expect(401);
  });

  it('gives each login only its own screens', async () => {
    const orders = (await login('orders@smellme.test', 'Orders-Pass-2026')).body.token as string;
    await t.http.get('/api/admin/orders').set(bearer(orders)).expect(200);
    await t.http.get('/api/admin/products').set(bearer(orders)).expect(403);
    const owner = (await login('owner@smellme.test', 'Owner-Pass-2026')).body.token as string;
    await t.http.get('/api/admin/products').set(bearer(owner)).expect(200);
    await t.http.get('/api/admin/logins').set(bearer(owner)).expect(200);
  });

  it('can be run again: it resets a changed password and screens instead of failing or duplicating', async () => {
    await t.db.query(`UPDATE admin_users SET allowed_screens = ARRAY['logs'], is_active = false WHERE email = 'orders@smellme.test'`);
    await t.db.query(SQL);
    expect((await t.db.query('SELECT count(*)::int AS n FROM admin_users'))[0].n).toBe(4);
    const res = await login('orders@smellme.test', 'Orders-Pass-2026').expect(200);
    expect(res.body.user.screens).toEqual(['orders', 'customers', 'reviews']);
  });
});
