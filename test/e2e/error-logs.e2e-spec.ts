import './utils/test-env';
import { buildApp, tokenFor, TestApp } from './utils/build-app';
import { bearer } from './utils/catalog-fixtures';

describe('admin error logs', () => {
  let t: TestApp;
  let owner: string;
  beforeEach(async () => { t = await buildApp(); owner = (await tokenFor(t, null)).token; });
  afterEach(() => t.close());

  const log = (group: string, over: Record<string, unknown> = {}) =>
    t.db.query(
      `INSERT INTO api_error_logs (group_key, group_label, severity, status_code, method, url, message, created_at)
       VALUES ($1, $2, $3, $4, 'POST', '/api/x', $5, COALESCE($6::timestamptz, now()))`,
      [group, `${group} label`, over.severity ?? 'error', over.status ?? 500, over.message ?? 'boom', over.at ?? null],
    );
  const groups = (qs = '', token = owner) => t.http.get(`/api/admin/error-logs${qs}`).set(bearer(token));

  it('is only for admins with the logs screen', async () => {
    await t.http.get('/api/admin/error-logs').expect(401);
    await groups('', (await tokenFor(t, ['orders'])).token).expect(403);
    await groups('', (await tokenFor(t, ['logs'])).token).expect(200);
  });

  it('is empty to start with', async () => {
    expect((await groups().expect(200)).body).toMatchObject({ total: 0, items: [] });
  });

  it('groups repeats of the same failure, newest first, with a count and the latest status', async () => {
    await log('Orders.create', { at: '2026-10-01T10:00:00Z', status: 400 });
    await log('Orders.create', { at: '2026-10-02T10:00:00Z', status: 500 });
    await log('Cart.price', { at: '2026-10-03T10:00:00Z', severity: 'warning', status: 404 });
    const { body } = await groups().expect(200);
    expect(body.total).toBe(2);
    expect(body.items.map((g: { group_key: string }) => g.group_key)).toEqual(['Cart.price', 'Orders.create']);
    expect(body.items[1]).toMatchObject({ count: 2, status_code: 500, has_error: true });
    expect(body.items[0]).toMatchObject({ count: 1, has_error: false });
  });

  it('filters by severity', async () => {
    await log('A', { severity: 'error' });
    await log('B', { severity: 'warning' });
    expect((await groups('?severity=warning')).body.items.map((g: { group_key: string }) => g.group_key)).toEqual(['B']);
    await groups('?severity=fatal').expect(400);
  });

  it('lists the entries of one group, newest first, and pages them', async () => {
    for (let i = 1; i <= 3; i++) await log('Orders.create', { message: `failure ${i}`, at: `2026-10-0${i}T10:00:00Z` });
    await log('Other');
    const get = (qs: string) => t.http.get(`/api/admin/error-logs/entries?group=Orders.create${qs}`).set(bearer(owner));
    const first = (await get('&limit=2').expect(200)).body;
    expect(first.total).toBe(3);
    expect(first.items.map((e: { message: string }) => e.message)).toEqual(['failure 3', 'failure 2']);
    expect((await get('&limit=2&page=2')).body.items.map((e: { message: string }) => e.message)).toEqual(['failure 1']);
    await t.http.get('/api/admin/error-logs/entries').set(bearer(owner)).expect(400);
  });

  it('clears one group and leaves the others', async () => {
    await log('A'); await log('A'); await log('B');
    expect((await t.http.delete('/api/admin/error-logs?group=A').set(bearer(owner)).expect(200)).body).toEqual({ deleted: 2 });
    expect((await groups()).body.items.map((g: { group_key: string }) => g.group_key)).toEqual(['B']);
    await t.http.delete('/api/admin/error-logs').set(bearer(owner)).expect(400);
  });

  it('purges entries older than 30 days and keeps recent ones', async () => {
    await log('Old', { at: new Date(Date.now() - 40 * 86400_000).toISOString() });
    await log('Recent', { at: new Date(Date.now() - 5 * 86400_000).toISOString() });
    await (t.app.get((await import('../../src/common/api-error-logs/api-error-logs.service')).ApiErrorLogsService)).purgeOld(30);
    expect((await groups()).body.items.map((g: { group_key: string }) => g.group_key)).toEqual(['Recent']);
  });
});
