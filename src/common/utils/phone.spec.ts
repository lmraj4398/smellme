import { formatPhone, maskPhone, normalizeIndianMobile, toWhatsAppNumber } from './phone';

describe('normalizeIndianMobile', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['(98765) 43210', '+919876543210'],
    ['6000000000', '+916000000000'],
  ])('%s -> %s', (i, o) => expect(normalizeIndianMobile(i)).toBe(o));

  it.each(['', '12345', '5876543210', '98765432', '98765432101', '+1 415 555 2671', 'abcdefghij', '9876543210; DROP', '+91+9876543210', '91 9876 5432 1', null, undefined, 9876543210, {}, 'x'.repeat(50)])(
    'rejects %j',
    (v) => expect(normalizeIndianMobile(v)).toBeNull(),
  );

  it('gives WhatsApp digits, a display form and a masked form', () => {
    expect(toWhatsAppNumber('+919876543210')).toBe('919876543210');
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(maskPhone('+919876543210')).toBe('+••••••••3210');
  });
});
