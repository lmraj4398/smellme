import { readdirSync } from 'fs';
import { join } from 'path';

// Builds ONE SQL script that is the whole database: every migration, in order, in a single transaction.
// It is generated from the migration files themselves (each `up()` is run against a recorder that collects the
// statements instead of executing them), so it can never disagree with `npm run migration:run`.
//
// The script also records the migrations as applied in TypeORM's own `migrations` table, so after loading it the API
// (DB_MIGRATIONS_RUN=true) or `npm run migration:run` only applies migrations added later.

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');
const FILE = /^(\d+)-.+\.(ts|js)$/;

interface Migration { timestamp: number; name: string; statements: string[] }

async function load(dir: string): Promise<Migration[]> {
  const files = readdirSync(dir)
    .filter((f) => FILE.test(f) && !f.endsWith('.d.ts'))
    .sort((a, b) => Number(a.match(FILE)![1]) - Number(b.match(FILE)![1]));

  const out: Migration[] = [];
  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(join(dir, file)) as Record<string, new () => { name?: string; up(q: unknown): Promise<void> }>;
    const Cls = Object.values(mod).find((v) => typeof v === 'function' && typeof v.prototype?.up === 'function');
    if (!Cls) throw new Error(`${file} does not export a migration class`);
    const instance = new Cls();
    const statements: string[] = [];
    await instance.up({ query: async (sql: string) => { statements.push(sql.trim().replace(/;$/, '')); return []; } });
    out.push({ timestamp: Number(file.match(FILE)![1]), name: instance.name ?? Cls.name, statements });
  }
  return out;
}

export async function buildSchemaSql(dir = MIGRATIONS_DIR): Promise<string> {
  const migrations = await load(dir);
  const lines: string[] = [
    '-- SmellMe: complete database schema, generated from src/migrations by `npm run db:sql`. Do not edit by hand.',
    '--',
    '-- Load into an EMPTY PostgreSQL database (14 or newer):',
    '--   psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f db-scripts/schema.sql',
    '--',
    `-- Contains ${migrations.length} migrations (${migrations[0]?.name} ... ${migrations[migrations.length - 1]?.name}),`,
    '-- applied in one transaction: if anything fails, nothing is created.',
    '',
    'BEGIN;',
    '',
    '-- Needed for uuid_generate_v4(). TypeORM creates it on connect; a plain SQL load must do it itself.',
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
    '',
  ];

  for (const m of migrations) {
    lines.push(`-- -- ${m.name} ${'-'.repeat(Math.max(4, 70 - m.name.length))}`);
    for (const s of m.statements) lines.push(`${s};`);
    lines.push('');
  }

  lines.push(
    '-- -- Record the migrations as applied (TypeORM bookkeeping) ' + '-'.repeat(14),
    'CREATE TABLE "migrations" ("id" SERIAL NOT NULL, "timestamp" bigint NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id"));',
    `INSERT INTO "migrations" ("timestamp", "name") VALUES`,
    migrations.map((m, i) => `  (${m.timestamp}, '${m.name}')${i === migrations.length - 1 ? ';' : ','}`).join('\n'),
    '',
    'COMMIT;',
    '',
  );
  return lines.join('\n');
}
