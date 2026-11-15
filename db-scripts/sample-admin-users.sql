-- SmellMe: sample admin logins for DEVELOPMENT and DEMOS only.
--
-- !! These passwords are written down in this file, so anyone can use them. NEVER run this on the live shop.
-- !! On production create the real owner with `npm run seed:owner` / the owner.seed script instead.
--
-- Run after the tables exist (db-scripts/schema.sql, or the API started once in dev):
--   psql "postgresql://smellme:smellme_dev@localhost:5432/smellme_dev" -v ON_ERROR_STOP=1 -f db-scripts/sample-admin-users.sql
-- or with the dev Postgres container:
--   docker exec -i smellme_pg_dev psql -U smellme -d smellme_dev -v ON_ERROR_STOP=1 < db-scripts/sample-admin-users.sql
--
-- Safe to run again: an existing login with the same email gets its password, name and screens reset.
-- Sign in at http://localhost:5183 (admin panel).
--
--   Email                 Password            Can open
--   --------------------  ------------------  ------------------------------------------------------------
--   owner@smellme.test    Owner-Pass-2026     everything (the owner), including Logins and Settings
--   orders@smellme.test   Orders-Pass-2026    Orders, Verify payments, Customers, Reviews
--   catalog@smellme.test  Catalog-Pass-2026   Products, Brands, Inventory, Content, FAQs
--   support@smellme.test  Support-Pass-2026   Messages, Notifications, Reviews, Error logs
--
-- Passwords are stored as bcrypt hashes (cost 12), exactly as the API stores them.

INSERT INTO "admin_users" ("name", "email", "password_hash", "allowed_screens", "is_active")
VALUES
  ('Sample Owner',           'owner@smellme.test',   '$2b$12$DiXhMijqRJWs9jD/KPS/0.hNLtOh5yuYhMwOS.b6FFL/Rxs8p.MP2', NULL,                                          true),
  ('Sample Orders Desk',     'orders@smellme.test',  '$2b$12$gTgoA0sseO6ZHqaPeaiOA.acg851hpDQ8NdEKUH1qSPXrTKGbxbfu', ARRAY['orders','customers','reviews'],           true),
  ('Sample Catalog Manager', 'catalog@smellme.test', '$2b$12$hjGVJBIWfvuEEUa1SalDh.0Fk6TFs04lZXwFr3kviUCA9kPvai3L.', ARRAY['products','inventory','content'],        true),
  ('Sample Support',         'support@smellme.test', '$2b$12$5QXFGH96S3.FRpaVd3CgSORaBeoZN/Y.5sndOOb.4IJ0uEQmVGp9u', ARRAY['marketing','reviews','logs'],            true)
ON CONFLICT ("email") DO UPDATE SET
  "name"            = EXCLUDED."name",
  "password_hash"   = EXCLUDED."password_hash",
  "allowed_screens" = EXCLUDED."allowed_screens",
  "is_active"       = true,
  "updated_at"      = now();
