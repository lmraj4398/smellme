import { formatINR } from './utils';
import { paiseToRupees, rupeesToPaise } from './money';

describe('rupeesToPaise', () => {
  it.each([
    ['2850', 285000], ['2,850', 285000], ['₹ 2,850.50', 285050], ['0.5', 50], ['0.05', 5], ['19', 1900], [190, 19000], ['0', 0],
  ])('%s -> %s', (i, o) => expect(rupeesToPaise(i)).toBe(o));

  it.each(['', '-5', '12.345', 'abc', '1e3', '1.', '.5', '12,34,56.789'])('rejects %j', (i) => expect(rupeesToPaise(i)).toBeNull());
  it('rejects null/undefined', () => {
    expect(rupeesToPaise(null)).toBeNull();
    expect(rupeesToPaise(undefined)).toBeNull();
  });

  it('is exact where floating point is not (0.1 + 0.2 style traps)', () => {
    expect(rupeesToPaise('19.99')).toBe(1999);
    expect(rupeesToPaise('1.15')).toBe(115);
    expect(rupeesToPaise('4.35')).toBe(435);
  });
});

describe('paiseToRupees', () => {
  it.each([[285000, '2850'], [285050, '2850.5'], [285005, '2850.05'], [50, '0.5'], [0, '0']])('%s -> %s', (i, o) => expect(paiseToRupees(i)).toBe(o));
  it('returns empty for missing', () => expect(paiseToRupees(null)).toBe(''));
  it('round-trips every paise value in a range', () => {
    for (let p = 0; p < 20000; p += 7) expect(rupeesToPaise(paiseToRupees(p))).toBe(p);
  });
});

describe('formatINR', () => {
  it('formats paise for display with Indian grouping', () => expect(formatINR(28500000)).toBe('₹2,85,000'));
});
