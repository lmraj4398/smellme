-- SmellMe: complete database schema, generated from src/migrations by `npm run db:sql`. Do not edit by hand.
--
-- Load into an EMPTY PostgreSQL database (14 or newer):
--   psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f db-scripts/schema.sql
--
-- Contains 7 migrations (InitialSchema1792602431473 ... CustomerBirthday1792640000000),
-- applied in one transaction: if anything fails, nothing is created.

BEGIN;

-- Needed for uuid_generate_v4(). TypeORM creates it on connect; a plain SQL load must do it itself.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -- InitialSchema1792602431473 --------------------------------------------
CREATE TABLE "admin_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(254) NOT NULL, "password_hash" character varying(100) NOT NULL, "allowed_screens" text array, "is_active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dcd0c8a4b10af9c986e510b9ecc" UNIQUE ("email"), CONSTRAINT "PK_06744d221bb6145dc61e5dc441d" PRIMARY KEY ("id"));
CREATE TABLE "admin_refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "ip" character varying(64), "user_agent" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2e410bc860adf1f2c9d679a53b1" UNIQUE ("token_hash"), CONSTRAINT "PK_341c4a1fa29fa0017ed8ad0791f" PRIMARY KEY ("id"));
CREATE INDEX "IDX_48504c492aa684c7dd3b2a8e83" ON "admin_refresh_tokens" ("user_id");
CREATE INDEX "IDX_4aa7e3737b52bd9701350218ee" ON "admin_refresh_tokens" ("family_id");
CREATE INDEX "IDX_626d24b154b84b3f516d8bea6e" ON "admin_refresh_tokens" ("expires_at");

-- -- CatalogAndLogins1792605058033 -----------------------------------------
CREATE TABLE "api_error_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_key" character varying(200) NOT NULL, "group_label" character varying(200) NOT NULL, "severity" character varying(10) NOT NULL, "status_code" integer NOT NULL, "method" character varying(10) NOT NULL, "url" text NOT NULL, "request_query" text, "request_body" text, "message" text NOT NULL, "user_id" character varying(64), "user_type" character varying(20), "screen" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fba47c85f9649de5fcf2f527739" PRIMARY KEY ("id"));
CREATE INDEX "IDX_9970608b39923c779c7700146d" ON "api_error_logs" ("group_key");
CREATE INDEX "IDX_2501ddd341a9cff717a7e30abf" ON "api_error_logs" ("created_at");
CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "is_original" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_96db6bbbaa6f23cad26871339b6" UNIQUE ("name"), CONSTRAINT "UQ_b15428f362be2200922952dc268" UNIQUE ("slug"), CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"));
CREATE TABLE "scent_families" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60) NOT NULL, "slug" character varying(80) NOT NULL, "tint" character varying(7) NOT NULL DEFAULT '#F3E6D6', "ink" character varying(7) NOT NULL DEFAULT '#9A6A2E', "notes_hint" character varying(120) NOT NULL DEFAULT '', "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_89ac4c804dff27176ef231a2cdd" UNIQUE ("name"), CONSTRAINT "UQ_6518c7cc6f67ea39a7bbfd5d5b9" UNIQUE ("slug"), CONSTRAINT "PK_7a359dbd13b9f8e7af75a822a23" PRIMARY KEY ("id"));
CREATE TABLE "notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60) NOT NULL, "color" character varying(7) NOT NULL DEFAULT '#E8B46A', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_642d9663b6a9fe56f7a393ec0bb" UNIQUE ("name"), CONSTRAINT "PK_af6206538ea96c4e77e9f400c3d" PRIMARY KEY ("id"));
CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(140) NOT NULL, "name" character varying(140) NOT NULL, "brand_id" uuid NOT NULL, "family_id" uuid NOT NULL, "descriptors" character varying(80) NOT NULL DEFAULT '', "concentration" character varying(12) NOT NULL, "gender" character varying(10) NOT NULL, "short_description" text NOT NULL DEFAULT '', "story" text NOT NULL DEFAULT '', "how_to_wear" text NOT NULL DEFAULT '', "ingredients" text NOT NULL DEFAULT '', "badge" character varying(30) NOT NULL DEFAULT '', "tint" character varying(7) NOT NULL DEFAULT '#F3E6D6', "liquid" character varying(7) NOT NULL DEFAULT '#D7A260', "mono" character varying(4) NOT NULL DEFAULT '', "longevity_label" character varying(40) NOT NULL DEFAULT '', "longevity_level" smallint NOT NULL DEFAULT '3', "projection_label" character varying(40) NOT NULL DEFAULT '', "projection_level" smallint NOT NULL DEFAULT '3', "season_label" character varying(40) NOT NULL DEFAULT '', "season_level" smallint NOT NULL DEFAULT '3', "occasion_label" character varying(40) NOT NULL DEFAULT '', "occasion_level" smallint NOT NULL DEFAULT '3', "is_active" boolean NOT NULL DEFAULT true, "is_featured" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_464f927ae360106b783ed0b4106" UNIQUE ("slug"), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"));
CREATE INDEX "IDX_1530a6f15d3c79d1b70be98f2b" ON "products" ("brand_id");
CREATE INDEX "IDX_78bbdb337649eeefd5ef00a7b9" ON "products" ("family_id");
CREATE INDEX "IDX_995d8194c43edfc98838cabc5a" ON "products" ("created_at");
CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "sku" character varying(40) NOT NULL, "label" character varying(40) NOT NULL, "size_ml" integer NOT NULL, "price_paise" integer NOT NULL, "mrp_paise" integer, "is_sample" boolean NOT NULL DEFAULT false, "stock" integer NOT NULL DEFAULT '0', "low_stock_at" integer NOT NULL DEFAULT '5', "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_46f236f21640f9da218a063a866" UNIQUE ("sku"), CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"));
CREATE INDEX "IDX_6343513e20e2deab45edfce131" ON "product_variants" ("product_id");
CREATE TABLE "product_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "note_id" uuid NOT NULL, "tier" character varying(5) NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_0c2e756f96dacb2b19470136964" UNIQUE ("product_id", "note_id", "tier"), CONSTRAINT "PK_2085982b3083c582b7db37738f8" PRIMARY KEY ("id"));
CREATE INDEX "IDX_f7b6e70696318a5c8d1dc021fe" ON "product_notes" ("product_id");
CREATE TABLE "product_media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "key" character varying(200) NOT NULL, "alt" character varying(140) NOT NULL DEFAULT '', "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_09d4639de8082a32aa27f3ac9a6" PRIMARY KEY ("id"));
CREATE INDEX "IDX_e6bb4a69096db4f6a1f5bada15" ON "product_media" ("product_id");
CREATE TABLE "stock_ledger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "variant_id" uuid NOT NULL, "delta" integer NOT NULL, "balance_after" integer NOT NULL, "reason" character varying(12) NOT NULL, "note" text, "ref" character varying(60), "admin_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bb04575ee2ff52f72028f669701" PRIMARY KEY ("id"));
CREATE INDEX "IDX_2e430b9ae5dfaaee70a25f9628" ON "stock_ledger" ("variant_id");
CREATE INDEX "IDX_0def5a8f767d73d98ec7491168" ON "stock_ledger" ("created_at");
ALTER TABLE "products" ADD CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "products" ADD CONSTRAINT "FK_78bbdb337649eeefd5ef00a7b92" FOREIGN KEY ("family_id") REFERENCES "scent_families"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "product_variants" ADD CONSTRAINT "FK_6343513e20e2deab45edfce1316" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "product_notes" ADD CONSTRAINT "FK_f7b6e70696318a5c8d1dc021fe4" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "product_notes" ADD CONSTRAINT "FK_d572251339880235ec917b151ea" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE "product_media" ADD CONSTRAINT "FK_e6bb4a69096db4f6a1f5bada151" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "stock_ledger" ADD CONSTRAINT "FK_2e430b9ae5dfaaee70a25f96284" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- -- ContentAndInbox1792607113847 ------------------------------------------
CREATE TABLE "contact_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "phone" character varying(30) NOT NULL DEFAULT '', "email" character varying(254) NOT NULL DEFAULT '', "topic" character varying(60) NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b74f96eb2edd977ccfba6533293" PRIMARY KEY ("id"));
CREATE INDEX "IDX_e55d44314cdf69654a2eb6325a" ON "contact_messages" ("is_read");
CREATE INDEX "IDX_11eb2c3d2d9e07f264907f40ef" ON "contact_messages" ("created_at");
CREATE TABLE "newsletter_subscribers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0dc48416511f011f7de7b2a8f83" UNIQUE ("email"), CONSTRAINT "PK_38f9333e9961b2fdb589128d19b" PRIMARY KEY ("id"));
CREATE TABLE "site_content" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "page" character varying(30) NOT NULL, "section" character varying(40) NOT NULL, "data" jsonb NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a81cc80566ba2627cdae73b31fe" UNIQUE ("page", "section"), CONSTRAINT "PK_a1362a1a095ab41c4347aea2c2d" PRIMARY KEY ("id"));

-- -- CommerceOrdersCustomers1792610961930 ----------------------------------
CREATE TABLE "whatsapp_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event" character varying(30) NOT NULL, "to_masked" character varying(20) NOT NULL, "template_id" character varying(80) NOT NULL DEFAULT '', "params" jsonb NOT NULL, "status" character varying(10) NOT NULL, "provider_message_id" character varying(120), "error" text, "ref" character varying(40), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_807bc612c6b98de7645a99805ca" PRIMARY KEY ("id"));
CREATE INDEX "IDX_ddc65377c6f0d49e0424b2385d" ON "whatsapp_messages" ("event");
CREATE INDEX "IDX_559aa6c5989dd2d37c8003f6be" ON "whatsapp_messages" ("status");
CREATE INDEX "IDX_648a219189cabaaf46c450409f" ON "whatsapp_messages" ("created_at");
CREATE TABLE "app_settings" ("key" character varying(60) NOT NULL, "value" jsonb NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY ("key"));
CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_seq" SERIAL NOT NULL, "customer_id" uuid NOT NULL, "client_ref" uuid NOT NULL, "status" character varying(20) NOT NULL, "subtotal_paise" integer NOT NULL, "discount_paise" integer NOT NULL DEFAULT '0', "delivery_fee_paise" integer NOT NULL DEFAULT '0', "gift_wrap_paise" integer NOT NULL DEFAULT '0', "total_paise" integer NOT NULL, "coupon_code" character varying(30), "gift_wrap" boolean NOT NULL DEFAULT false, "gift_message" text NOT NULL DEFAULT '', "engraving" character varying(30) NOT NULL DEFAULT '', "ship_name" character varying(120) NOT NULL, "ship_phone" character varying(14) NOT NULL, "ship_line1" character varying(200) NOT NULL, "ship_line2" character varying(200) NOT NULL DEFAULT '', "ship_city" character varying(80) NOT NULL, "ship_state" character varying(60) NOT NULL, "ship_pincode" character varying(6) NOT NULL, "receipt_key" character varying(200), "utr" character varying(40), "paid_amount_paise" integer, "payment_submitted_at" TIMESTAMP WITH TIME ZONE, "payment_verified_at" TIMESTAMP WITH TIME ZONE, "payment_verified_by" uuid, "payment_reject_reason" text, "packed_at" TIMESTAMP WITH TIME ZONE, "carrier" character varying(60), "tracking_no" character varying(80), "shipped_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" text, "cancelled_by" character varying(10), "refund_due" boolean NOT NULL DEFAULT false, "refunded_at" TIMESTAMP WITH TIME ZONE, "refund_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ea859ebfa61c0b71f1bacb69a1c" UNIQUE ("customer_id", "client_ref"), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "IDX_044317fbe95661e7ae7497d482" ON "orders" ("order_seq");
CREATE INDEX "IDX_772d0ce0473ac2ccfa26060dbe" ON "orders" ("customer_id");
CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders" ("status");
CREATE INDEX "IDX_5c7c1ffb7d084c5d1ceec54b21" ON "orders" ("utr");
CREATE INDEX "IDX_c884e321f927d5b86aac7c8f9e" ON "orders" ("created_at");
CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "product_id" uuid NOT NULL, "product_slug" character varying(140) NOT NULL, "sku" character varying(40) NOT NULL, "name" character varying(140) NOT NULL, "brand" character varying(100) NOT NULL, "label" character varying(40) NOT NULL, "size_ml" integer NOT NULL, "unit_price_paise" integer NOT NULL, "qty" integer NOT NULL, "line_total_paise" integer NOT NULL, "is_free_sample" boolean NOT NULL DEFAULT false, "image_key" character varying(200), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"));
CREATE INDEX "IDX_145532db85752b29c57d2b7b1f" ON "order_items" ("order_id");
CREATE TABLE "order_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "from_status" character varying(20), "to_status" character varying(20) NOT NULL, "actor_type" character varying(10) NOT NULL, "actor_id" uuid, "note" text, "meta" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cc1b82b0fcf1be577d9d7ecbf8b" PRIMARY KEY ("id"));
CREATE INDEX "IDX_b33cbf9a59cbee112d94bcb59d" ON "order_events" ("order_id");
CREATE INDEX "IDX_36bbf4b79da9c0e9da199b9afa" ON "order_events" ("created_at");
CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(30) NOT NULL, "description" character varying(120) NOT NULL DEFAULT '', "type" character varying(8) NOT NULL, "value" integer NOT NULL, "min_order_paise" integer NOT NULL DEFAULT '0', "max_discount_paise" integer, "starts_at" TIMESTAMP WITH TIME ZONE, "ends_at" TIMESTAMP WITH TIME ZONE, "max_uses" integer, "per_customer_limit" integer NOT NULL DEFAULT '1', "used_count" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"));
CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying(14) NOT NULL, "name" character varying(120) NOT NULL DEFAULT '', "email" character varying(254) NOT NULL DEFAULT '', "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_88acd889fbe17d0e16cc4bc9174" UNIQUE ("phone"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"));
CREATE TABLE "customer_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "label" character varying(30) NOT NULL DEFAULT '', "name" character varying(120) NOT NULL, "phone" character varying(14) NOT NULL, "line1" character varying(200) NOT NULL, "line2" character varying(200) NOT NULL DEFAULT '', "city" character varying(80) NOT NULL, "state" character varying(60) NOT NULL, "pincode" character varying(6) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_336bda7b0a0cd04241f719fc834" PRIMARY KEY ("id"));
CREATE INDEX "IDX_6be4e1a698f5c3f2c2e4c75c18" ON "customer_addresses" ("customer_id");
CREATE TABLE "customer_otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying(14) NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumed_at" TIMESTAMP WITH TIME ZONE, "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_291c1c28ac460b417de185f0a2b" PRIMARY KEY ("id"));
CREATE INDEX "IDX_ae04d2939724745cce204b27fa" ON "customer_otps" ("phone");
CREATE INDEX "IDX_573edd97712e0ce54341a950e9" ON "customer_otps" ("created_at");
CREATE TABLE "customer_refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "ip" character varying(64), "user_agent" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_db450cd4bbe1b7ca4c36762c777" UNIQUE ("token_hash"), CONSTRAINT "PK_a0872102f2c477ecc4264a1bc93" PRIMARY KEY ("id"));
CREATE INDEX "IDX_64ee8c9d54275883c6068e70a1" ON "customer_refresh_tokens" ("customer_id");
CREATE INDEX "IDX_8a4cb496b129f22e9383798fec" ON "customer_refresh_tokens" ("family_id");
CREATE INDEX "IDX_9920e669de31d00f955a117d16" ON "customer_refresh_tokens" ("expires_at");

-- -- Wishlist1792620000000 -------------------------------------------------
CREATE TABLE "wishlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "product_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_wishlist_customer_product" UNIQUE ("customer_id", "product_id"), CONSTRAINT "PK_wishlist_items_id" PRIMARY KEY ("id"));
CREATE INDEX "IDX_wishlist_items_customer_id" ON "wishlist_items" ("customer_id");

-- -- Reviews1792630000000 --------------------------------------------------
CREATE TABLE "product_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "rating" smallint NOT NULL, "title" character varying(80) NOT NULL DEFAULT '', "body" character varying(1500) NOT NULL DEFAULT '', "status" character varying(10) NOT NULL DEFAULT 'published', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_reviews_customer_product" UNIQUE ("customer_id", "product_id"), CONSTRAINT "PK_product_reviews_id" PRIMARY KEY ("id"));
CREATE INDEX "IDX_product_reviews_product_status" ON "product_reviews" ("product_id", "status");

-- -- CustomerBirthday1792640000000 -----------------------------------------
ALTER TABLE "customers" ADD "birthday" date;

-- -- Record the migrations as applied (TypeORM bookkeeping) --------------
CREATE TABLE "migrations" ("id" SERIAL NOT NULL, "timestamp" bigint NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY ("id"));
INSERT INTO "migrations" ("timestamp", "name") VALUES
  (1792602431473, 'InitialSchema1792602431473'),
  (1792605058033, 'CatalogAndLogins1792605058033'),
  (1792607113847, 'ContentAndInbox1792607113847'),
  (1792610961930, 'CommerceOrdersCustomers1792610961930'),
  (1792620000000, 'Wishlist1792620000000'),
  (1792630000000, 'Reviews1792630000000'),
  (1792640000000, 'CustomerBirthday1792640000000');

COMMIT;
