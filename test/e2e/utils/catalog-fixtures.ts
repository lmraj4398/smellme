import { TestApp } from './build-app';

export const MEDIA_A = 'media/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp';
export const MEDIA_B = 'media/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg';

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface Refs {
  brandId: string;
  familyId: string;
  noteIds: string[];
}

/** Brand + family + 3 notes straight into the DB (bypasses the API so tests of the API stay focused). */
export async function seedRefs(t: TestApp, over: { brand?: string; family?: string } = {}): Promise<Refs> {
  const ins = async (sql: string, params: unknown[]) => (await t.db.query(sql, params))[0].id as string;
  const brandId = await ins(
    `INSERT INTO brands (name, slug, is_original) VALUES ($1, $2, true) RETURNING id`,
    [over.brand ?? 'SmellMe Originals', (over.brand ?? 'SmellMe Originals').toLowerCase().replace(/\W+/g, '-')],
  );
  const familyId = await ins(
    `INSERT INTO scent_families (name, slug) VALUES ($1, $2) RETURNING id`,
    [over.family ?? 'Amber', (over.family ?? 'Amber').toLowerCase()],
  );
  const noteIds: string[] = [];
  for (const n of ['Saffron', 'Rose', 'Vanilla']) noteIds.push(await ins(`INSERT INTO notes (name) VALUES ($1) RETURNING id`, [n]));
  return { brandId, familyId, noteIds };
}

/** A valid ProductDto payload. Override any field. */
export function productPayload(refs: Refs, over: Record<string, unknown> = {}) {
  return {
    name: 'Saffron Dusk',
    brand_id: refs.brandId,
    family_id: refs.familyId,
    descriptors: 'Amber · Spicy',
    concentration: 'edp',
    gender: 'unisex',
    short_description: 'Kashmiri saffron warmed with rose.',
    badge: 'New',
    mono: 'SD',
    variants: [
      { label: '2 ml sample', size_ml: 2, price_paise: 19000, is_sample: true, stock: 40 },
      { label: '50 ml', size_ml: 50, price_paise: 285000, mrp_paise: 310000, stock: 10 },
    ],
    notes: [
      { note_id: refs.noteIds[0], tier: 'top' },
      { note_id: refs.noteIds[1], tier: 'heart' },
      { note_id: refs.noteIds[2], tier: 'base' },
    ],
    media: [{ key: MEDIA_A, alt: 'Bottle' }],
    ...over,
  };
}

export async function createProduct(t: TestApp, token: string, payload: object) {
  const res = await t.http.post('/api/admin/products').set(bearer(token)).send(payload).expect(201);
  return res.body as { id: string; slug: string; variants: { id: string; sku: string; stock: number; size_ml: number; is_active: boolean }[] };
}
