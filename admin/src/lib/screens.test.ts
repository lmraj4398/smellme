import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NAV } from './nav-routes';
import { SCREEN_LABELS } from './screens';

// The screen keys exist in three places: the API's SCREENS list, this app's labels, and NAV.
// If they drift, a screen silently becomes impossible to grant (or grantable but not enforced).
// The API lives at the repo root (../../../src from here).
const SCREEN_FILE = resolve(__dirname, '../../../src/common/decorators/screen.decorator.ts');

describe('screen keys stay in sync', () => {
  const apiSource = readFileSync(SCREEN_FILE, 'utf8');
  const apiScreens = [...apiSource.slice(apiSource.indexOf('export const SCREENS')).matchAll(/'([a-z]+)'/g)].map((m) => m[1]);

  it('found the API list', () => expect(apiScreens.length).toBeGreaterThan(5));
  it('labels cover exactly the screens the API knows', () => expect(Object.keys(SCREEN_LABELS).sort()).toEqual([...apiScreens].sort()));
  it('every screen used by the menu is a real, grantable screen', () => {
    for (const n of NAV) if (n.screen) expect(apiScreens).toContain(n.screen);
  });
});
