// Gift-set budgets and order-number tracking: small pure helpers, so the pages stay thin and these are easy to test.

export const BUDGETS = [
  { id: 'all', label: 'All' },
  { id: 'u1500', label: 'Under ₹1,500', max: 1500 },
  { id: 'mid', label: '₹1,500 – ₹3,000', min: 1500, max: 3000 },
  { id: 'o3000', label: '₹3,000+', min: 3000 },
] as const;
export type BudgetId = (typeof BUDGETS)[number]['id'];

/** The first rupee amount in a free-text price like "₹1,499" or "From ₹2,450", or null if there is none. */
export function priceFromText(text: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(text ?? '');
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Does a set priced `text` fit the budget? "All" matches everything; a set with no readable price only matches "All". */
export function inBudget(text: string, id: BudgetId): boolean {
  const b = BUDGETS.find((x) => x.id === id);
  if (!b || b.id === 'all') return true;
  const price = priceFromText(text);
  if (price === null) return false;
  const min = 'min' in b ? b.min : 0;
  const max = 'max' in b ? b.max : Infinity;
  return price >= min && price < max;
}

/** "SM-001002", "sm 001002" or "001002" -> "SM-001002"; anything else -> null. */
export function normalizeOrderNo(input: string): string | null {
  const m = /^(?:SM)?[\s-]*(\d{4,8})$/i.exec(input.trim());
  return m ? `SM-${m[1]}` : null;
}
