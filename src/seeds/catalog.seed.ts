import 'reflect-metadata';
import dataSource from '../data-source';
import { Product, ProductNote, ProductVariant, StockLedger } from '../models/catalog/entities/product.entities';
import { Brand, Note, ScentFamily } from '../models/catalog/entities/taxonomy.entities';
import { isProductionEnv } from '../common/utils/env.util';
import { slugify } from '../common/utils/slug';

// DEMO catalog taken from the design prototype: 5 brands, 7 scent families, 8 fragrances.
// Names, notes and prices are placeholders to be replaced in the admin panel.
//   dev:  npm run seed:catalog
// Idempotent: anything that already exists (matched by slug / name) is left untouched.
// Refuses to run in production unless SEED_DEMO_CATALOG=yes, so demo products can't land on the live store by accident.

const BRANDS = [
  { name: 'SmellMe Originals', is_original: true },
  { name: 'Maison Aurel' }, { name: 'Atelier Noor' }, { name: 'Kasturi & Co.' }, { name: 'Vellum Paris' },
];

const FAMILIES = [
  { name: 'Floral', tint: '#F6E6E3', ink: '#A0626A', notes_hint: 'Rose, jasmine, tuberose' },
  { name: 'Woody', tint: '#E6EADF', ink: '#5E6B45', notes_hint: 'Sandal, vetiver, cedar' },
  { name: 'Fresh', tint: '#E5ECEF', ink: '#4D6F7D', notes_hint: 'Citrus, sea, green tea' },
  { name: 'Amber', tint: '#F3E6D6', ink: '#9A6A2E', notes_hint: 'Saffron, vanilla, resin' },
  { name: 'Oud', tint: '#ECE2D6', ink: '#6E4E33', notes_hint: 'Agarwood, smoke, leather' },
  { name: 'Attar', tint: '#F1E8DC', ink: '#8A6630', notes_hint: 'Pure oils, mitti, kewda' },
  { name: 'Powdery', tint: '#EEE8F0', ink: '#7A6A8A', notes_hint: 'Iris, musk, soft suede' },
];

const NOTES: [string, string][] = [
  ['Saffron', '#E8B46A'], ['Pink pepper', '#E9B7B0'], ['Bergamot', '#E6E1A8'], ['Rose', '#E2A5A8'],
  ['Cardamom', '#C7D0A6'], ['Oud', '#B28A66'], ['Amber', '#D9A25B'], ['Vanilla', '#F0E2C2'],
  ['Sandalwood', '#D6BB92'], ['Vetiver', '#A9B58A'], ['Wet earth', '#B7A58B'], ['Jasmine', '#F2E9D8'],
  ['Neroli', '#EBD9A0'], ['Iris', '#C8B9D3'], ['Sea salt', '#BCD5DE'], ['Lemon', '#EDE08A'], ['Musk', '#E3D5C6'],
];

interface Seed {
  name: string; brand: string; family: string; descriptors: string; concentration: 'extrait' | 'edp' | 'edt' | 'attar' | 'mist';
  gender: 'women' | 'men' | 'unisex'; tint: string; liquid: string; mono: string; badge: string; featured?: boolean;
  full: { ml: number; rupees: number }[]; notes: { top: string[]; heart: string[]; base: string[] };
  longevity: [string, number]; projection: [string, number]; season: [string, number]; occasion: [string, number];
}

const P: Seed[] = [
  { name: 'Monsoon Vetiver', brand: 'SmellMe Originals', family: 'Woody', descriptors: 'Woody · Earthy', concentration: 'edp', gender: 'unisex', tint: '#E6EADF', liquid: '#B7C09A', mono: 'MV', badge: 'Bestseller', featured: true, full: [{ ml: 50, rupees: 2450 }, { ml: 100, rupees: 3950 }], notes: { top: ['Bergamot', 'Cardamom'], heart: ['Vetiver', 'Wet earth'], base: ['Sandalwood', 'Musk'] }, longevity: ['6–8 hours', 4], projection: ['Moderate', 3], season: ['Monsoon · Winter', 3], occasion: ['Day to evening', 3] },
  { name: 'Saffron Dusk', brand: 'SmellMe Originals', family: 'Amber', descriptors: 'Amber · Spicy', concentration: 'edp', gender: 'unisex', tint: '#F3E6D6', liquid: '#D7A260', mono: 'SD', badge: 'New', featured: true, full: [{ ml: 50, rupees: 2850 }, { ml: 10, rupees: 790 }, { ml: 100, rupees: 4450 }], notes: { top: ['Saffron', 'Pink pepper', 'Bergamot'], heart: ['Rose', 'Cardamom', 'Oud'], base: ['Amber', 'Vanilla', 'Sandalwood'] }, longevity: ['8–10 hours', 4], projection: ['Moderate', 3], season: ['Winter · Monsoon', 3], occasion: ['Evening', 4] },
  { name: 'Jasmine Sambac Nuit', brand: 'Atelier Noor', family: 'Floral', descriptors: 'Floral · White flowers', concentration: 'edp', gender: 'women', tint: '#F6EEE7', liquid: '#EBD7B5', mono: 'JS', badge: '', full: [{ ml: 75, rupees: 3600 }], notes: { top: ['Neroli', 'Bergamot'], heart: ['Jasmine', 'Rose'], base: ['Musk', 'Vanilla'] }, longevity: ['6–8 hours', 4], projection: ['Moderate', 3], season: ['All year', 3], occasion: ['Evening', 4] },
  { name: 'Oud Ivoire', brand: 'Maison Aurel', family: 'Oud', descriptors: 'Oud · Smoky', concentration: 'extrait', gender: 'unisex', tint: '#EEE5D9', liquid: '#AE7E52', mono: 'OI', badge: 'Exclusive', full: [{ ml: 50, rupees: 6900 }], notes: { top: ['Saffron', 'Cardamom'], heart: ['Oud', 'Rose'], base: ['Amber', 'Sandalwood'] }, longevity: ['10+ hours', 5], projection: ['Strong', 4], season: ['Winter', 5], occasion: ['Evening · Weddings', 5] },
  { name: 'Citrus Marina', brand: 'SmellMe Originals', family: 'Fresh', descriptors: 'Fresh · Aquatic', concentration: 'edt', gender: 'men', tint: '#E5ECEF', liquid: '#BCD5DE', mono: 'CM', badge: '', full: [{ ml: 100, rupees: 1950 }], notes: { top: ['Lemon', 'Bergamot'], heart: ['Sea salt', 'Neroli'], base: ['Musk', 'Vetiver'] }, longevity: ['3–5 hours', 2], projection: ['Skin close', 2], season: ['Summer', 1], occasion: ['Day', 1] },
  { name: 'Rose Velours', brand: 'Kasturi & Co.', family: 'Attar', descriptors: 'Rose · Attar oil', concentration: 'attar', gender: 'unisex', tint: '#F5E4E1', liquid: '#D9A0A0', mono: 'RV', badge: 'New', full: [{ ml: 12, rupees: 1450 }], notes: { top: ['Rose'], heart: ['Rose', 'Sandalwood'], base: ['Musk', 'Amber'] }, longevity: ['8–10 hours', 4], projection: ['Skin close', 2], season: ['All year', 3], occasion: ['Day to evening', 3] },
  { name: 'Iris Poudré', brand: 'Vellum Paris', family: 'Powdery', descriptors: 'Powdery · Iris', concentration: 'edp', gender: 'women', tint: '#EEE8F0', liquid: '#C8B9D3', mono: 'IP', badge: '', full: [{ ml: 50, rupees: 5400 }], notes: { top: ['Pink pepper', 'Bergamot'], heart: ['Iris', 'Rose'], base: ['Musk', 'Vanilla'] }, longevity: ['6–8 hours', 4], projection: ['Moderate', 3], season: ['Spring · Winter', 3], occasion: ['Day to evening', 3] },
  { name: 'Mysore Sandal', brand: 'Kasturi & Co.', family: 'Woody', descriptors: 'Woody · Creamy', concentration: 'edp', gender: 'unisex', tint: '#F1E8DC', liquid: '#D2B48A', mono: 'MS', badge: '', full: [{ ml: 50, rupees: 2200 }], notes: { top: ['Cardamom'], heart: ['Sandalwood', 'Jasmine'], base: ['Sandalwood', 'Vanilla'] }, longevity: ['6–8 hours', 4], projection: ['Moderate', 3], season: ['All year', 3], occasion: ['Day to evening', 3] },
];

// A 2 ml vial costs roughly 7% of the full bottle, rounded to a tidy ₹10.
const samplePaise = (fullRupees: number) => Math.max(90, Math.round((fullRupees * 0.07) / 10) * 10) * 100;

async function main() {
  if (isProductionEnv(process.env.NODE_ENV) && process.env.SEED_DEMO_CATALOG !== 'yes') {
    throw new Error('Refusing to seed DEMO products in production. Set SEED_DEMO_CATALOG=yes if you really mean it.');
  }
  await dataSource.initialize();
  let created = 0;
  try {
    await dataSource.transaction(async (m) => {
      const brand = new Map<string, Brand>();
      for (const [i, b] of BRANDS.entries()) {
        const slug = slugify(b.name);
        brand.set(b.name, (await m.findOne(Brand, { where: { slug } })) ?? (await m.save(Brand, m.create(Brand, { ...b, slug, sort_order: i }))));
      }
      const family = new Map<string, ScentFamily>();
      for (const [i, f] of FAMILIES.entries()) {
        const slug = slugify(f.name);
        family.set(f.name, (await m.findOne(ScentFamily, { where: { slug } })) ?? (await m.save(ScentFamily, m.create(ScentFamily, { ...f, slug, sort_order: i }))));
      }
      const note = new Map<string, Note>();
      for (const [name, color] of NOTES) {
        note.set(name, (await m.findOne(Note, { where: { name } })) ?? (await m.save(Note, m.create(Note, { name, color }))));
      }

      for (const [i, p] of P.entries()) {
        const slug = slugify(p.name);
        if (await m.exists(Product, { where: { slug } })) continue;
        const row = await m.save(Product, m.create(Product, {
          slug, name: p.name, brand_id: brand.get(p.brand)!.id, family_id: family.get(p.family)!.id, descriptors: p.descriptors,
          concentration: p.concentration, gender: p.gender, tint: p.tint, liquid: p.liquid, mono: p.mono, badge: p.badge,
          is_featured: !!p.featured, sort_order: i,
          short_description: `${p.name} - ${p.descriptors.toLowerCase()}. Demo copy: replace in the admin panel.`,
          longevity_label: p.longevity[0], longevity_level: p.longevity[1], projection_label: p.projection[0], projection_level: p.projection[1],
          season_label: p.season[0], season_level: p.season[1], occasion_label: p.occasion[0], occasion_level: p.occasion[1],
        }));

        // Order matters: the first full-size bottle is the one shown on cards.
        const sizes = [{ label: '2 ml sample', ml: 2, paise: samplePaise(p.full[0].rupees), sample: true }, ...p.full.map((f) => ({ label: `${f.ml} ml`, ml: f.ml, paise: f.rupees * 100, sample: false }))];
        for (const [j, s] of sizes.entries()) {
          const v = await m.save(ProductVariant, m.create(ProductVariant, {
            product_id: row.id, sku: `${slug}-${s.ml}ml`, label: s.label, size_ml: s.ml, price_paise: s.paise, is_sample: s.sample, sort_order: j, stock: 25,
          }));
          await m.insert(StockLedger, { variant_id: v.id, delta: 25, balance_after: 25, reason: 'opening', note: 'Demo seed' });
        }

        let order = 0;
        const seen = new Set<string>();
        for (const tier of ['top', 'heart', 'base'] as const) {
          for (const n of p.notes[tier]) {
            if (seen.has(`${n}:${tier}`)) continue;
            seen.add(`${n}:${tier}`);
            await m.insert(ProductNote, { product_id: row.id, note_id: note.get(n)!.id, tier, sort_order: order++ });
          }
        }
        created++;
      }
    });
    console.log(created ? `Seeded ${created} demo products.` : 'Demo catalog already present - nothing to do.');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
