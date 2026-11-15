import { MAX_QTY, selectCount, selectSubtotal, useBag, type BagLine } from './cart.store';

const V1 = '11111111-1111-4111-8111-111111111111';
const V2 = '22222222-2222-4222-8222-222222222222';
const line = (over: Partial<Omit<BagLine, 'qty'>> = {}): Omit<BagLine, 'qty'> => ({
  variantId: V1, productSlug: 'saffron-dusk', name: 'Saffron Dusk', brand: 'SmellMe Originals', label: '50 ml',
  price_paise: 285000, tint: '#F3E6D6', liquid: '#D7A260', mono: 'SD', image: null, ...over,
});

beforeEach(() => {
  localStorage.clear();
  useBag.setState({ lines: [] });
});

describe('bag store', () => {
  it('adds a line with quantity 1 by default', () => {
    useBag.getState().add(line());
    expect(useBag.getState().lines).toEqual([{ ...line(), qty: 1 }]);
  });

  it('adding the same size again increases the quantity instead of duplicating the line', () => {
    useBag.getState().add(line());
    useBag.getState().add(line(), 2);
    expect(useBag.getState().lines).toHaveLength(1);
    expect(useBag.getState().lines[0].qty).toBe(3);
  });

  it('caps quantity at the maximum and never below 1', () => {
    useBag.getState().add(line(), 50);
    expect(useBag.getState().lines[0].qty).toBe(MAX_QTY);
    useBag.getState().setQty(V1, 0);
    expect(useBag.getState().lines[0].qty).toBe(1);
    useBag.getState().setQty(V1, -4);
    expect(useBag.getState().lines[0].qty).toBe(1);
    useBag.getState().setQty(V1, 3.9);
    expect(useBag.getState().lines[0].qty).toBe(3);
    useBag.getState().setQty(V1, NaN);
    expect(useBag.getState().lines[0].qty).toBe(1);
  });

  it('refreshes the displayed price when a size is re-added', () => {
    useBag.getState().add(line({ price_paise: 285000 }));
    useBag.getState().add(line({ price_paise: 299000 }));
    expect(useBag.getState().lines[0].price_paise).toBe(299000);
  });

  it('removes and clears', () => {
    useBag.getState().add(line());
    useBag.getState().add(line({ variantId: V2, label: '100 ml' }));
    useBag.getState().remove(V1);
    expect(useBag.getState().lines.map((l) => l.variantId)).toEqual([V2]);
    useBag.getState().clear();
    expect(useBag.getState().lines).toEqual([]);
  });

  it('counts items and totals paise exactly', () => {
    useBag.getState().add(line(), 2);
    useBag.getState().add(line({ variantId: V2, price_paise: 19050 }), 3);
    expect(selectCount(useBag.getState())).toBe(5);
    expect(selectSubtotal(useBag.getState())).toBe(2 * 285000 + 3 * 19050);
  });

  it('persists to localStorage', () => {
    useBag.getState().add(line());
    expect(JSON.parse(localStorage.getItem('smellme-bag-v1')!).state.lines).toHaveLength(1);
  });

  it('discards malformed lines when rehydrating tampered storage', async () => {
    localStorage.setItem('smellme-bag-v1', JSON.stringify({
      version: 1,
      state: { lines: [
        { ...line(), qty: 2 },
        { ...line({ variantId: 'not-a-uuid' }), qty: 1 },
        { ...line({ variantId: V2 }), qty: 1, price_paise: -5 },
        { ...line({ variantId: V2 }), qty: 1, price_paise: 10.5 },
        { variantId: V2 },
        'junk', null,
        { ...line({ variantId: '33333333-3333-4333-8333-333333333333' }), qty: 9999 },
      ] },
    }));
    await useBag.persist.rehydrate();
    expect(useBag.getState().lines.map((l) => [l.variantId, l.qty])).toEqual([[V1, 2], ['33333333-3333-4333-8333-333333333333', MAX_QTY]]);
  });

  it('survives storage that is not an object at all', async () => {
    localStorage.setItem('smellme-bag-v1', JSON.stringify({ version: 1, state: { lines: 'lol' } }));
    await useBag.persist.rehydrate();
    expect(useBag.getState().lines).toEqual([]);
  });
});
