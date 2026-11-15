import { slugify } from './slug';

describe('slugify (must match the API)', () => {
  it.each([
    ['Jasmine Sambac Nuit', 'jasmine-sambac-nuit'],
    ['Iris Poudré', 'iris-poudre'],
    ['Kasturi & Co.', 'kasturi-and-co'],
    ['  --Oud   Ivoire!! ', 'oud-ivoire'],
  ])('%s -> %s', (i, o) => expect(slugify(i)).toBe(o));
});
