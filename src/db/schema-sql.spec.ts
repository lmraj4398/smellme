import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { buildSchemaSql } from './schema-sql';

const FILE = join(__dirname, '..', '..', 'db-scripts', 'schema.sql');
const norm = (s: string) => s.replace(/\r\n/g, '\n');

describe('db-scripts/schema.sql', () => {
  it('is up to date with src/migrations (run `npm run db:sql` after adding a migration)', async () => {
    expect(norm(readFileSync(FILE, 'utf8'))).toBe(await buildSchemaSql());
  });

  describe('the generated script', () => {
    let sql: string;
    beforeAll(async () => { sql = await buildSchemaSql(); });

    it('is one transaction that installs the uuid extension first', () => {
      const body = sql.split('\n').filter((l) => !l.startsWith('--') && l.trim());
      expect(body[0]).toBe('BEGIN;');
      expect(body[1]).toBe('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
      expect(body[body.length - 1]).toBe('COMMIT;');
      expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1);
    });

    it('contains every migration, in order, and records each as applied', () => {
      const files = readdirSync(join(__dirname, '..', 'migrations')).filter((f) => /^\d+-.+\.ts$/.test(f)).sort();
      const timestamps = files.map((f) => f.split('-')[0]);
      const recorded = [...sql.matchAll(/^  \((\d+), '/gm)].map((m) => m[1]);
      expect(recorded).toEqual(timestamps);
      const headings = [...sql.matchAll(/^-- -- (\w+) /gm)].map((m) => m[1]).filter((n) => /\d{10,}$/.test(n));
      expect(headings.map((h) => h.match(/\d+$/)![0])).toEqual(timestamps);
    });

    it('has only complete statements and no leftover TypeORM placeholders', () => {
      const statements = sql.split('\n').filter((l) => /^(CREATE|ALTER|DROP|INSERT)/.test(l));
      expect(statements.length).toBeGreaterThan(50);
      for (const s of statements) expect(s.trimEnd().endsWith(';') || s.endsWith('VALUES')).toBe(true);
      expect(sql).not.toMatch(/undefined|\[object|\$\{/);
    });

    it('creates the tables the app needs', () => {
      for (const t of ['admin_users', 'products', 'product_variants', 'customers', 'orders', 'order_items', 'coupons', 'wishlist_items', 'product_reviews', 'api_error_logs', 'migrations']) {
        expect(sql).toContain(`CREATE TABLE "${t}"`);
      }
      expect(sql).toContain('ALTER TABLE "customers" ADD "birthday" date');
    });
  });
});
