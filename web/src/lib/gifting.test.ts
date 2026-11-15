import { inBudget, normalizeOrderNo, priceFromText } from './gifting';

describe('priceFromText', () => {
  it.each([['₹1,499', 1499], ['From ₹2,450', 2450], ['Rs. 999', 999], ['₹1,499.50', 1499.5]])('reads %j as %d', (t, n) => {
    expect(priceFromText(t)).toBe(n);
  });
  it.each(['', 'Ask us', 'TBA', '₹0'])('finds no price in %j', (t) => expect(priceFromText(t)).toBeNull());
});

describe('inBudget', () => {
  it('"All" matches everything, including sets with no readable price', () => {
    expect(inBudget('', 'all')).toBe(true);
    expect(inBudget('₹9,999', 'all')).toBe(true);
  });
  it('puts a price in exactly one band, with the boundary in the higher band', () => {
    expect(inBudget('₹1,499', 'u1500')).toBe(true);
    expect(inBudget('₹1,500', 'u1500')).toBe(false);
    expect(inBudget('₹1,500', 'mid')).toBe(true);
    expect(inBudget('₹2,999', 'mid')).toBe(true);
    expect(inBudget('₹3,000', 'mid')).toBe(false);
    expect(inBudget('₹3,000', 'o3000')).toBe(true);
  });
  it('hides sets without a readable price from every specific band', () => {
    for (const id of ['u1500', 'mid', 'o3000'] as const) expect(inBudget('', id)).toBe(false);
  });
});

describe('normalizeOrderNo', () => {
  it.each([['SM-001002', 'SM-001002'], [' sm-001002 ', 'SM-001002'], ['sm 001002', 'SM-001002'], ['001002', 'SM-001002'], ['SM001002', 'SM-001002']])('accepts %j', (i, o) => {
    expect(normalizeOrderNo(i)).toBe(o);
  });
  it.each(['', 'SM-12', 'ABC-001002', '98765 43210', 'SM-001002/../x', '12345678901'])('rejects %j', (i) => expect(normalizeOrderNo(i)).toBeNull());
});
