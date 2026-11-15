import { toSearchParams } from '@/api/catalog';
import { activeCount, EMPTY_FILTERS, filtersToParams, parseFilters, toApiQuery, toggleIn, type ShopFilters } from './shop-query';

const parse = (s: string) => parseFilters(new URLSearchParams(s));

describe('parseFilters', () => {
  it('reads an empty URL as no filters', () => expect(parse('')).toEqual(EMPTY_FILTERS));

  it('reads lists, band, sample, sort and search', () => {
    expect(parse('family=amber,oud&brand=smellme-originals&gender=men&concentration=edp&price=m&sample=true&sort=low&q=saffron')).toEqual({
      q: 'saffron', family: ['amber', 'oud'], brand: ['smellme-originals'], gender: ['men'], concentration: ['edp'], band: 'm', sample: true, sort: 'low',
    });
  });

  it('ignores junk: unknown sort or band, empty list items, absurd search length', () => {
    const f = parse(`sort=random&price=free&family=,,amber,&q=${'x'.repeat(500)}&sample=yes`);
    expect(f).toMatchObject({ sort: 'pop', band: null, family: ['amber'], sample: false });
    expect(f.q).toHaveLength(80);
  });
});

describe('filtersToParams', () => {
  it('omits defaults so a clean shop URL stays clean', () => expect(filtersToParams(EMPTY_FILTERS).toString()).toBe(''));

  it('round-trips every filter', () => {
    const f: ShopFilters = { q: 'rose', family: ['floral', 'attar'], brand: ['x'], gender: ['women'], concentration: ['attar'], band: 'u2', sample: true, sort: 'high' };
    expect(parseFilters(filtersToParams(f))).toEqual(f);
  });
});

describe('toApiQuery', () => {
  it('turns a price band into a paise range', () => {
    expect(toApiQuery({ ...EMPTY_FILTERS, band: 'u2' }, 1)).toMatchObject({ price_max: 200000 });
    expect(toApiQuery({ ...EMPTY_FILTERS, band: 'u2' }, 1).price_min).toBeUndefined();
    expect(toApiQuery({ ...EMPTY_FILTERS, band: 'm' }, 1)).toMatchObject({ price_min: 200000, price_max: 400000 });
    expect(toApiQuery({ ...EMPTY_FILTERS, band: 'o4' }, 1)).toMatchObject({ price_min: 400000 });
    expect(toApiQuery({ ...EMPTY_FILTERS, band: 'o4' }, 1).price_max).toBeUndefined();
  });

  it('produces a clean query string for the API', () => {
    const s = toSearchParams(toApiQuery({ ...EMPTY_FILTERS, family: ['amber', 'oud'], q: ' saffron ', sample: true, sort: 'low' }, 2, 12)).toString();
    expect(s).toBe('q=saffron&family=amber%2Coud&sample=true&sort=low&page=2&limit=12');
  });

  it('sends nothing for empty filters beyond sort/page', () => {
    expect(toSearchParams(toApiQuery(EMPTY_FILTERS, 1)).toString()).toBe('sort=pop&page=1&limit=12');
  });
});

describe('helpers', () => {
  it('counts active filters', () => {
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    expect(activeCount({ ...EMPTY_FILTERS, family: ['a', 'b'], band: 'm', sample: true, q: 'x' })).toBe(5);
  });
  it('toggles list membership without mutating', () => {
    const a = ['x'];
    expect(toggleIn(a, 'y')).toEqual(['x', 'y']);
    expect(toggleIn(['x', 'y'], 'x')).toEqual(['y']);
    expect(a).toEqual(['x']);
  });
});
