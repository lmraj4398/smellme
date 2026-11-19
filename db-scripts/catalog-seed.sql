-- DEMO catalog: 5 brands, 7 scent families, 17 notes, 8 fragrances (each with a 2 ml sample, 25 units of stock).
-- Same data as src/seeds/catalog.seed.ts, as plain SQL. Names, notes and prices are placeholders: replace them in the admin panel.
-- Idempotent: anything that already exists (matched by slug / name / sku) is left untouched, so it is safe to run twice.
-- Needs the tables to exist (start the API once, or load db-scripts/schema.sql first).
--   psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f db-scripts/catalog-seed.sql
-- Do not run this on the live shop unless you really want demo products there.
BEGIN;

-- Brands
INSERT INTO brands (name, slug, is_original, sort_order) VALUES
  ('SmellMe Originals', 'smellme-originals', true, 0),
  ('Maison Aurel', 'maison-aurel', false, 1),
  ('Atelier Noor', 'atelier-noor', false, 2),
  ('Kasturi & Co.', 'kasturi-and-co', false, 3),
  ('Vellum Paris', 'vellum-paris', false, 4)
ON CONFLICT DO NOTHING;

-- Scent families
INSERT INTO scent_families (name, slug, tint, ink, notes_hint, sort_order) VALUES
  ('Floral', 'floral', '#F6E6E3', '#A0626A', 'Rose, jasmine, tuberose', 0),
  ('Woody', 'woody', '#E6EADF', '#5E6B45', 'Sandal, vetiver, cedar', 1),
  ('Fresh', 'fresh', '#E5ECEF', '#4D6F7D', 'Citrus, sea, green tea', 2),
  ('Amber', 'amber', '#F3E6D6', '#9A6A2E', 'Saffron, vanilla, resin', 3),
  ('Oud', 'oud', '#ECE2D6', '#6E4E33', 'Agarwood, smoke, leather', 4),
  ('Attar', 'attar', '#F1E8DC', '#8A6630', 'Pure oils, mitti, kewda', 5),
  ('Powdery', 'powdery', '#EEE8F0', '#7A6A8A', 'Iris, musk, soft suede', 6)
ON CONFLICT DO NOTHING;

-- Notes
INSERT INTO notes (name, color) VALUES
  ('Saffron', '#E8B46A'),
  ('Pink pepper', '#E9B7B0'),
  ('Bergamot', '#E6E1A8'),
  ('Rose', '#E2A5A8'),
  ('Cardamom', '#C7D0A6'),
  ('Oud', '#B28A66'),
  ('Amber', '#D9A25B'),
  ('Vanilla', '#F0E2C2'),
  ('Sandalwood', '#D6BB92'),
  ('Vetiver', '#A9B58A'),
  ('Wet earth', '#B7A58B'),
  ('Jasmine', '#F2E9D8'),
  ('Neroli', '#EBD9A0'),
  ('Iris', '#C8B9D3'),
  ('Sea salt', '#BCD5DE'),
  ('Lemon', '#EDE08A'),
  ('Musk', '#E3D5C6')
ON CONFLICT DO NOTHING;

-- Monsoon Vetiver
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'monsoon-vetiver', 'Monsoon Vetiver', (SELECT id FROM brands WHERE slug = 'smellme-originals'), (SELECT id FROM scent_families WHERE slug = 'woody'),
  'Woody · Earthy', 'edp', 'unisex', '#E6EADF', '#B7C09A', 'MV', 'Bestseller', true, 0,
  'Monsoon Vetiver - woody · earthy. Demo copy: replace in the admin panel.',
  '6–8 hours', 4, 'Moderate', 3, 'Monsoon · Winter', 3, 'Day to evening', 3
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'monsoon-vetiver-2ml', '2 ml sample', 2, 17000, true, 0, 25 FROM products WHERE slug = 'monsoon-vetiver'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'monsoon-vetiver-50ml', '50 ml', 50, 245000, false, 1, 25 FROM products WHERE slug = 'monsoon-vetiver'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'monsoon-vetiver-100ml', '100 ml', 100, 395000, false, 2, 25 FROM products WHERE slug = 'monsoon-vetiver'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'monsoon-vetiver'), n.id, t.tier, t.ord
FROM (VALUES
  ('Bergamot', 'top', 0),
  ('Cardamom', 'top', 1),
  ('Vetiver', 'heart', 2),
  ('Wet earth', 'heart', 3),
  ('Sandalwood', 'base', 4),
  ('Musk', 'base', 5)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

-- Saffron Dusk
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'saffron-dusk', 'Saffron Dusk', (SELECT id FROM brands WHERE slug = 'smellme-originals'), (SELECT id FROM scent_families WHERE slug = 'amber'),
  'Amber · Spicy', 'edp', 'unisex', '#F3E6D6', '#D7A260', 'SD', 'New', true, 1,
  'Saffron Dusk - amber · spicy. Demo copy: replace in the admin panel.',
  '8–10 hours', 4, 'Moderate', 3, 'Winter · Monsoon', 3, 'Evening', 4
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'saffron-dusk-2ml', '2 ml sample', 2, 20000, true, 0, 25 FROM products WHERE slug = 'saffron-dusk'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'saffron-dusk-50ml', '50 ml', 50, 285000, false, 1, 25 FROM products WHERE slug = 'saffron-dusk'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'saffron-dusk-10ml', '10 ml', 10, 79000, false, 2, 25 FROM products WHERE slug = 'saffron-dusk'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'saffron-dusk-100ml', '100 ml', 100, 445000, false, 3, 25 FROM products WHERE slug = 'saffron-dusk'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'saffron-dusk'), n.id, t.tier, t.ord
FROM (VALUES
  ('Saffron', 'top', 0),
  ('Pink pepper', 'top', 1),
  ('Bergamot', 'top', 2),
  ('Rose', 'heart', 3),
  ('Cardamom', 'heart', 4),
  ('Oud', 'heart', 5),
  ('Amber', 'base', 6),
  ('Vanilla', 'base', 7),
  ('Sandalwood', 'base', 8)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

-- Jasmine Sambac Nuit
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'jasmine-sambac-nuit', 'Jasmine Sambac Nuit', (SELECT id FROM brands WHERE slug = 'atelier-noor'), (SELECT id FROM scent_families WHERE slug = 'floral'),
  'Floral · White flowers', 'edp', 'women', '#F6EEE7', '#EBD7B5', 'JS', '', false, 2,
  'Jasmine Sambac Nuit - floral · white flowers. Demo copy: replace in the admin panel.',
  '6–8 hours', 4, 'Moderate', 3, 'All year', 3, 'Evening', 4
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'jasmine-sambac-nuit-2ml', '2 ml sample', 2, 25000, true, 0, 25 FROM products WHERE slug = 'jasmine-sambac-nuit'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'jasmine-sambac-nuit-75ml', '75 ml', 75, 360000, false, 1, 25 FROM products WHERE slug = 'jasmine-sambac-nuit'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'jasmine-sambac-nuit'), n.id, t.tier, t.ord
FROM (VALUES
  ('Neroli', 'top', 0),
  ('Bergamot', 'top', 1),
  ('Jasmine', 'heart', 2),
  ('Rose', 'heart', 3),
  ('Musk', 'base', 4),
  ('Vanilla', 'base', 5)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

-- Oud Ivoire
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'oud-ivoire', 'Oud Ivoire', (SELECT id FROM brands WHERE slug = 'maison-aurel'), (SELECT id FROM scent_families WHERE slug = 'oud'),
  'Oud · Smoky', 'extrait', 'unisex', '#EEE5D9', '#AE7E52', 'OI', 'Exclusive', false, 3,
  'Oud Ivoire - oud · smoky. Demo copy: replace in the admin panel.',
  '10+ hours', 5, 'Strong', 4, 'Winter', 5, 'Evening · Weddings', 5
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'oud-ivoire-2ml', '2 ml sample', 2, 48000, true, 0, 25 FROM products WHERE slug = 'oud-ivoire'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'oud-ivoire-50ml', '50 ml', 50, 690000, false, 1, 25 FROM products WHERE slug = 'oud-ivoire'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'oud-ivoire'), n.id, t.tier, t.ord
FROM (VALUES
  ('Saffron', 'top', 0),
  ('Cardamom', 'top', 1),
  ('Oud', 'heart', 2),
  ('Rose', 'heart', 3),
  ('Amber', 'base', 4),
  ('Sandalwood', 'base', 5)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

-- Citrus Marina
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'citrus-marina', 'Citrus Marina', (SELECT id FROM brands WHERE slug = 'smellme-originals'), (SELECT id FROM scent_families WHERE slug = 'fresh'),
  'Fresh · Aquatic', 'edt', 'men', '#E5ECEF', '#BCD5DE', 'CM', '', false, 4,
  'Citrus Marina - fresh · aquatic. Demo copy: replace in the admin panel.',
  '3–5 hours', 2, 'Skin close', 2, 'Summer', 1, 'Day', 1
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'citrus-marina-2ml', '2 ml sample', 2, 14000, true, 0, 25 FROM products WHERE slug = 'citrus-marina'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'citrus-marina-100ml', '100 ml', 100, 195000, false, 1, 25 FROM products WHERE slug = 'citrus-marina'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'citrus-marina'), n.id, t.tier, t.ord
FROM (VALUES
  ('Lemon', 'top', 0),
  ('Bergamot', 'top', 1),
  ('Sea salt', 'heart', 2),
  ('Neroli', 'heart', 3),
  ('Musk', 'base', 4),
  ('Vetiver', 'base', 5)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

-- Rose Velours
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'rose-velours', 'Rose Velours', (SELECT id FROM brands WHERE slug = 'kasturi-and-co'), (SELECT id FROM scent_families WHERE slug = 'attar'),
  'Rose · Attar oil', 'attar', 'unisex', '#F5E4E1', '#D9A0A0', 'RV', 'New', false, 5,
  'Rose Velours - rose · attar oil. Demo copy: replace in the admin panel.',
  '8–10 hours', 4, 'Skin close', 2, 'All year', 3, 'Day to evening', 3
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'rose-velours-2ml', '2 ml sample', 2, 10000, true, 0, 25 FROM products WHERE slug = 'rose-velours'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'rose-velours-12ml', '12 ml', 12, 145000, false, 1, 25 FROM products WHERE slug = 'rose-velours'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'rose-velours'), n.id, t.tier, t.ord
FROM (VALUES
  ('Rose', 'top', 0),
  ('Rose', 'heart', 1),
  ('Sandalwood', 'heart', 2),
  ('Musk', 'base', 3),
  ('Amber', 'base', 4)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

-- Iris Poudré
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'iris-poudre', 'Iris Poudré', (SELECT id FROM brands WHERE slug = 'vellum-paris'), (SELECT id FROM scent_families WHERE slug = 'powdery'),
  'Powdery · Iris', 'edp', 'women', '#EEE8F0', '#C8B9D3', 'IP', '', false, 6,
  'Iris Poudré - powdery · iris. Demo copy: replace in the admin panel.',
  '6–8 hours', 4, 'Moderate', 3, 'Spring · Winter', 3, 'Day to evening', 3
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'iris-poudre-2ml', '2 ml sample', 2, 38000, true, 0, 25 FROM products WHERE slug = 'iris-poudre'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'iris-poudre-50ml', '50 ml', 50, 540000, false, 1, 25 FROM products WHERE slug = 'iris-poudre'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'iris-poudre'), n.id, t.tier, t.ord
FROM (VALUES
  ('Pink pepper', 'top', 0),
  ('Bergamot', 'top', 1),
  ('Iris', 'heart', 2),
  ('Rose', 'heart', 3),
  ('Musk', 'base', 4),
  ('Vanilla', 'base', 5)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

-- Mysore Sandal
INSERT INTO products (slug, name, brand_id, family_id, descriptors, concentration, gender, tint, liquid, mono, badge, is_featured, sort_order, short_description,
  longevity_label, longevity_level, projection_label, projection_level, season_label, season_level, occasion_label, occasion_level)
SELECT 'mysore-sandal', 'Mysore Sandal', (SELECT id FROM brands WHERE slug = 'kasturi-and-co'), (SELECT id FROM scent_families WHERE slug = 'woody'),
  'Woody · Creamy', 'edp', 'unisex', '#F1E8DC', '#D2B48A', 'MS', '', false, 7,
  'Mysore Sandal - woody · creamy. Demo copy: replace in the admin panel.',
  '6–8 hours', 4, 'Moderate', 3, 'All year', 3, 'Day to evening', 3
ON CONFLICT (slug) DO NOTHING;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'mysore-sandal-2ml', '2 ml sample', 2, 15000, true, 0, 25 FROM products WHERE slug = 'mysore-sandal'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
WITH v AS (
  INSERT INTO product_variants (product_id, sku, label, size_ml, price_paise, is_sample, sort_order, stock)
  SELECT id, 'mysore-sandal-50ml', '50 ml', 50, 220000, false, 1, 25 FROM products WHERE slug = 'mysore-sandal'
  ON CONFLICT (sku) DO NOTHING RETURNING id
)
INSERT INTO stock_ledger (variant_id, delta, balance_after, reason, note) SELECT id, 25, 25, 'opening', 'Demo seed' FROM v;
INSERT INTO product_notes (product_id, note_id, tier, sort_order)
SELECT (SELECT id FROM products WHERE slug = 'mysore-sandal'), n.id, t.tier, t.ord
FROM (VALUES
  ('Cardamom', 'top', 0),
  ('Sandalwood', 'heart', 1),
  ('Jasmine', 'heart', 2),
  ('Sandalwood', 'base', 3),
  ('Vanilla', 'base', 4)
) AS t(note, tier, ord) JOIN notes n ON n.name = t.note
ON CONFLICT (product_id, note_id, tier) DO NOTHING;

COMMIT;
