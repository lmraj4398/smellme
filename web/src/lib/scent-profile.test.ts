import { birthdayLabel, levelFor, profileHeadline } from './scent-profile';

const f = (name: string, share: number) => ({ name, slug: name.toLowerCase(), qty: 1, share });

describe('levelFor', () => {
  it.each([[1, 'Loves'], [0.75, 'Loves'], [0.74, 'Likes'], [0.5, 'Likes'], [0.49, 'Sometimes'], [0.25, 'Sometimes'], [0.24, 'Rarely'], [0, 'Rarely']])('%d is %s', (share, level) => {
    expect(levelFor(share)).toBe(level);
  });
});

describe('profileHeadline', () => {
  it('names the families that are really liked, at most two', () => {
    expect(profileHeadline([f('Amber', 1), f('Woody', 0.6), f('Floral', 0.5)])).toBe('Amber & woody');
  });
  it('uses one family when only one stands out', () => {
    expect(profileHeadline([f('Amber', 1), f('Woody', 0.3)])).toBe('Amber');
  });
  it('is empty with no purchases', () => {
    expect(profileHeadline([])).toBe('');
  });
});

describe('birthdayLabel', () => {
  it('shows day and month without the year', () => {
    expect(birthdayLabel('1994-08-21')).toBe('21 Aug');
  });
  it.each([null, undefined, '', 'nope', '21-08-1994'])('is empty for %j', (v) => expect(birthdayLabel(v)).toBe(''));
});
