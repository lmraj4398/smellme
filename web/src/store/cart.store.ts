import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const MAX_QTY = 9;

// What the bag remembers about a size so it can show the line without another request.
// Display only: at checkout the SERVER re-prices every line from the database, so
// nothing stored here (price included) is ever trusted.
export interface BagLine {
  variantId: string;
  productSlug: string;
  name: string;
  brand: string;
  label: string;
  price_paise: number;
  tint: string;
  liquid: string;
  mono: string;
  image: string | null;
  qty: number;
}

// Choices made in the bag that travel with it to checkout.
export interface BagOptions {
  coupon_code: string;
  gift_wrap: boolean;
  gift_message: string;
  engraving: string;
  free_sample_ids: string[];
}
export const NO_OPTIONS: BagOptions = { coupon_code: '', gift_wrap: false, gift_message: '', engraving: '', free_sample_ids: [] };

interface BagState {
  lines: BagLine[];
  options: BagOptions;
  setOptions: (patch: Partial<BagOptions>) => void;
  add: (line: Omit<BagLine, 'qty'>, qty?: number) => void;
  setQty: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const clamp = (n: number) => Math.max(1, Math.min(MAX_QTY, Math.floor(Number.isFinite(n) ? n : 1)));

export const useBag = create<BagState>()(
  persist(
    (set) => ({
      lines: [],
      options: NO_OPTIONS,
      setOptions: (patch) => set((s) => ({ options: { ...s.options, ...patch } })),
      add: (line, qty = 1) =>
        set((s) => {
          const existing = s.lines.find((l) => l.variantId === line.variantId);
          if (existing) {
            // Re-adding refreshes the display data (price may have changed) and bumps the quantity.
            return { lines: s.lines.map((l) => (l.variantId === line.variantId ? { ...line, qty: clamp(l.qty + qty) } : l)) };
          }
          return { lines: [...s.lines, { ...line, qty: clamp(qty) }] };
        }),
      setQty: (variantId, qty) => set((s) => ({ lines: s.lines.map((l) => (l.variantId === variantId ? { ...l, qty: clamp(qty) } : l)) })),
      remove: (variantId) => set((s) => ({ lines: s.lines.filter((l) => l.variantId !== variantId) })),
      clear: () => set({ lines: [], options: NO_OPTIONS }),
    }),
    {
      name: 'smellme-bag-v1',
      version: 1,
      // localStorage is user-editable: keep only well-formed lines when loading it back.
      merge: (persisted, current) => {
        const raw = (persisted as { lines?: unknown } | undefined)?.lines;
        const lines = Array.isArray(raw) ? raw.filter(isLine).map((l) => ({ ...l, qty: clamp(l.qty) })) : [];
        return { ...current, lines, options: cleanOptions((persisted as { options?: unknown } | undefined)?.options) };
      },
    },
  ),
);

function cleanOptions(v: unknown): BagOptions {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const str = (x: unknown, max: number) => (typeof x === 'string' ? x.slice(0, max) : '');
  return {
    coupon_code: str(o.coupon_code, 40), gift_wrap: o.gift_wrap === true, gift_message: str(o.gift_message, 250), engraving: str(o.engraving, 14),
    free_sample_ids: Array.isArray(o.free_sample_ids) ? o.free_sample_ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)).slice(0, 5) : [],
  };
}

function isLine(v: unknown): v is BagLine {
  if (typeof v !== 'object' || v === null) return false;
  const l = v as Record<string, unknown>;
  return (
    typeof l.variantId === 'string' && /^[0-9a-f-]{36}$/i.test(l.variantId) &&
    typeof l.productSlug === 'string' && typeof l.name === 'string' && typeof l.label === 'string' &&
    Number.isInteger(l.price_paise) && (l.price_paise as number) >= 0 && typeof l.qty === 'number'
  );
}

export const selectCount = (s: BagState) => s.lines.reduce((n, l) => n + l.qty, 0);
export const selectSubtotal = (s: BagState) => s.lines.reduce((n, l) => n + l.price_paise * l.qty, 0);

/** The bag as the API's pricing/order endpoints want it: ids and quantities only - never prices. */
export function bagToInput(lines: BagLine[], o: BagOptions) {
  return {
    lines: lines.map((l) => ({ variant_id: l.variantId, qty: l.qty })),
    ...(o.coupon_code.trim() ? { coupon_code: o.coupon_code.trim() } : {}),
    ...(o.gift_wrap ? { gift_wrap: true } : {}),
    ...(o.free_sample_ids.length ? { free_sample_ids: o.free_sample_ids } : {}),
  };
}
