import { card } from '@/test/render';
import { QUESTIONS, buildQueries, findMatches, isComplete, resultFamily } from './scent-finder';

const pick = (label: string): [number, number] => {
  for (let q = 0; q < QUESTIONS.length; q++) {
    const i = QUESTIONS[q].options.findIndex((o) => o.label === label);
    if (i >= 0) return [q, i];
  }
  throw new Error(label);
};
const answers = (...labels: string[]) => Object.fromEntries(labels.map(pick));

describe('scent finder', () => {
  it('is complete only when every question is answered', () => {
    expect(isComplete({ 0: 0, 1: 0, 2: 0, 3: 0 })).toBe(false);
    expect(isComplete({ 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 })).toBe(true);
  });

  it('maps the chosen place to a scent family', () => {
    expect(resultFamily(answers('The sea at sunrise'))).toBe('fresh');
    expect(resultFamily({})).toBe('amber');
  });

  it('builds the strictest query first and widens from there', () => {
    const qs = buildQueries(answers('A gift for him', 'A spice market at dusk', 'Make an entrance', '₹2,000 – ₹4,000'));
    expect(qs[0]).toMatchObject({ family: ['amber'], gender: ['men', 'unisex'], concentration: ['extrait', 'edp'], price_min: 200000, price_max: 400000 });
    expect(qs[1].price_max).toBeUndefined();
    expect(qs[2].gender).toBeUndefined();
    expect(qs[3].family).toBeUndefined();
  });

  it('asks for samples when the shopper wants to try first', () => {
    expect(buildQueries(answers('Samples first'))[0].sample).toBe(true);
  });

  it('tops up to three without repeating a product', async () => {
    const a = card({ id: 'a' }), b = card({ id: 'b' }), c = card({ id: 'c' });
    const fetchPage = vi.fn().mockResolvedValueOnce({ items: [a] }).mockResolvedValueOnce({ items: [a, b] }).mockResolvedValueOnce({ items: [b, c] });
    const out = await findMatches({}, fetchPage);
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
});
