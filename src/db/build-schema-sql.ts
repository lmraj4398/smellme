import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { buildSchemaSql } from './schema-sql';

// `npm run db:sql` -> db-scripts/schema.sql
const target = join(__dirname, '..', '..', 'db-scripts', 'schema.sql');

buildSchemaSql()
  .then((sql) => {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, sql, 'utf8');
    console.log(`Wrote ${target} (${sql.split('\n').length} lines)`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
