import { slugify } from './slug';

describe('slugify', () => {
  it.each([
    ['Jasmine Sambac Nuit', 'jasmine-sambac-nuit'],
    ['Iris Poudré', 'iris-poudre'],
    ['Kasturi & Co.', 'kasturi-and-co'],
    ['  --Oud   Ivoire!! ', 'oud-ivoire'],
    ['50 ml / EDP', '50-ml-edp'],
  ])('%s -> %s', (i, o) => expect(slugify(i)).toBe(o));

  it('returns empty for input with no usable characters', () => expect(slugify('***')).toBe(''));
  it('truncates without leaving a trailing dash', () => expect(slugify('a b'.repeat(20), 5)).not.toMatch(/-$/));
});
