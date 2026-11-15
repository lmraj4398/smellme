import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

// data-source.ts finds entities by filename for the migration CLI. An entity in a
// differently-named file still works at runtime (modules register it) but is silently
// MISSING from generated migrations, so production would be created without its table.
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe('entity files', () => {
  const files = walk(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  const withEntities = files
    .filter((f) => /^@Entity\(/m.test(readFileSync(f, 'utf8')))
    .map((f) => relative(__dirname, f).split(sep).join('/'));

  it('finds the entity files', () => expect(withEntities.length).toBeGreaterThanOrEqual(5));

  it('names every entity file *.entity.ts or *.entities.ts so the migration CLI sees it', () => {
    const misnamed = withEntities.filter((f) => !/\.entit(y|ies)\.ts$/.test(f));
    expect(misnamed).toEqual([]);
  });
});
