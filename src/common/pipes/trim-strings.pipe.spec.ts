import { trimDeep } from './trim-strings.pipe';

describe('trimDeep', () => {
  it('trims nested strings', () => {
    expect(trimDeep({ name: '  Ravi ', tags: [' a ', 'b '], n: { c: ' d ' } })).toEqual({
      name: 'Ravi',
      tags: ['a', 'b'],
      n: { c: 'd' },
    });
  });

  it('leaves credentials and OTP codes byte-exact', () => {
    const body = { password: ' pa ss ', otp: ' 123456 ', refresh_token: ' t ' };
    expect(trimDeep(body)).toEqual(body);
  });

  it('does not touch non-plain objects', () => {
    const d = new Date();
    expect(trimDeep({ d })).toEqual({ d });
  });
});
