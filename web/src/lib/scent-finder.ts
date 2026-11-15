import type { ProductCardData, ProductQuery } from '@/api/catalog';

// The scent-finder quiz. Answers narrow the live catalog, so matches are always real, in-stock products.
// Family slugs match the catalog seed (api/src/seeds/catalog.seed.ts).

export interface QuizOption {
  label: string; sub: string; swatch: string;
  family?: string; gender?: 'women' | 'men'; concentration?: string[]; band?: 'u2' | 'm' | 'o4'; sample?: boolean;
}
export interface QuizQuestion { title: string; sub: string; options: QuizOption[] }

export const QUESTIONS: QuizQuestion[] = [
  { title: 'Who is this fragrance for?', sub: 'We’ll tune the suggestions to them.', options: [
    { label: 'For me', sub: 'Something that feels like my own', swatch: '#F3E6D6' },
    { label: 'A gift for her', sub: 'Elegant, memorable', swatch: '#F6E6E3', gender: 'women' },
    { label: 'A gift for him', sub: 'Confident, refined', swatch: '#E5ECEF', gender: 'men' },
    { label: 'For anyone', sub: 'Unisex, easy to love', swatch: '#E6EADF' },
  ] },
  { title: 'Pick the place you’d rather be.', sub: 'Go with your first instinct.', options: [
    { label: 'A garden after rain', sub: 'Wet earth, green leaves', swatch: '#E6EADF', family: 'woody' },
    { label: 'A spice market at dusk', sub: 'Saffron, warmth, glow', swatch: '#F3E6D6', family: 'amber' },
    { label: 'The sea at sunrise', sub: 'Salt air, citrus, light', swatch: '#E5ECEF', family: 'fresh' },
    { label: 'A jasmine-lit terrace', sub: 'Night flowers, soft skin', swatch: '#F6E6E3', family: 'floral' },
  ] },
  { title: 'When will you wear it most?', sub: 'Choose the closest one.', options: [
    { label: 'Every day', sub: 'Office, college, errands', swatch: '#F4EEE4' },
    { label: 'Evenings out', sub: 'Dinners and dates', swatch: '#EADBC2' },
    { label: 'Weddings & festivals', sub: 'Long, special occasions', swatch: '#F3E6D6', concentration: ['extrait', 'edp'] },
    { label: 'All of these', sub: 'One scent for everything', swatch: '#E6EADF' },
  ] },
  { title: 'How noticeable should it be?', sub: 'Sillage is how far a scent travels.', options: [
    { label: 'A soft skin scent', sub: 'Only for those close to you', swatch: '#F6EEE7', concentration: ['edt', 'attar'] },
    { label: 'Noticeable', sub: 'A gentle trail', swatch: '#F1E5D1' },
    { label: 'Make an entrance', sub: 'Rich and long lasting', swatch: '#E2CDA8', concentration: ['extrait', 'edp'] },
  ] },
  { title: 'What’s your budget?', sub: 'Per full bottle.', options: [
    { label: 'Under ₹2,000', sub: 'Great everyday picks', swatch: '#F4EEE4', band: 'u2' },
    { label: '₹2,000 – ₹4,000', sub: 'The sweet spot', swatch: '#F1E5D1', band: 'm' },
    { label: '₹4,000 and above', sub: 'Niche & extrait', swatch: '#EADBC2', band: 'o4' },
    { label: 'Samples first', sub: 'I want to try before buying', swatch: '#E6EADF', sample: true },
  ] },
];

export const FAMILY_LINES: Record<string, { name: string; line: string }> = {
  woody: { name: 'woody & earthy notes', line: 'Grounded and calm — vetiver, sandalwood and the smell of rain on dry earth.' },
  amber: { name: 'amber & spice', line: 'Warm and magnetic — saffron, resins and a glow that lasts into the night.' },
  fresh: { name: 'fresh & aquatic notes', line: 'Bright and clean — citrus, sea air and green notes made for the heat.' },
  floral: { name: 'florals', line: 'Romantic and luminous — jasmine, rose and iris worn close to the skin.' },
};

/** answers[i] = index of the chosen option for question i. */
export type Answers = Record<number, number>;
export const isComplete = (a: Answers) => QUESTIONS.every((_, i) => a[i] !== undefined);

const chosen = (a: Answers): QuizOption[] => QUESTIONS.map((q, i) => q.options[a[i]]).filter(Boolean);
const BAND: Record<string, Pick<ProductQuery, 'price_min' | 'price_max'>> = {
  u2: { price_max: 200000 }, m: { price_min: 200000, price_max: 400000 }, o4: { price_min: 400000 },
};

export function resultFamily(a: Answers) {
  return chosen(a).find((o) => o.family)?.family ?? 'amber';
}

/**
 * Queries from strictest to loosest. The first fills as many of the three slots as it can; the later ones top up,
 * so a narrow answer set (say "men" + "floral") still returns three products rather than an empty page.
 */
export function buildQueries(a: Answers): ProductQuery[] {
  const opts = chosen(a);
  const family = resultFamily(a);
  const gender = opts.find((o) => o.gender)?.gender;
  const concentration = opts.find((o) => o.concentration)?.concentration;
  const band = opts.find((o) => o.band)?.band;
  const sample = opts.some((o) => o.sample) || undefined;
  const g = gender ? [gender, 'unisex'] : undefined;
  return [
    { family: [family], gender: g, concentration, ...(band ? BAND[band] : {}), sample, sort: 'pop', limit: 3 },
    { family: [family], gender: g, sample, sort: 'pop', limit: 3 },
    { family: [family], sort: 'pop', limit: 3 },
    { gender: g, sort: 'pop', limit: 3 },
  ];
}

export async function findMatches(a: Answers, fetchPage: (q: ProductQuery) => Promise<{ items: ProductCardData[] }>) {
  const seen = new Set<string>();
  const out: ProductCardData[] = [];
  for (const q of buildQueries(a)) {
    if (out.length >= 3) break;
    for (const p of (await fetchPage(q)).items) {
      if (out.length < 3 && !seen.has(p.id)) { seen.add(p.id); out.push(p); }
    }
  }
  return out;
}
