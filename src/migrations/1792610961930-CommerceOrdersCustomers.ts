import { MigrationInterface, QueryRunner } from "typeorm";

export class CommerceOrdersCustomers1792610961930 implements MigrationInterface {
    name = 'CommerceOrdersCustomers1792610961930'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "whatsapp_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "event" character varying(30) NOT NULL, "to_masked" character varying(20) NOT NULL, "template_id" character varying(80) NOT NULL DEFAULT '', "params" jsonb NOT NULL, "status" character varying(10) NOT NULL, "provider_message_id" character varying(120), "error" text, "ref" character varying(40), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_807bc612c6b98de7645a99805ca" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ddc65377c6f0d49e0424b2385d" ON "whatsapp_messages" ("event") `);
        await queryRunner.query(`CREATE INDEX "IDX_559aa6c5989dd2d37c8003f6be" ON "whatsapp_messages" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_648a219189cabaaf46c450409f" ON "whatsapp_messages" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "app_settings" ("key" character varying(60) NOT NULL, "value" jsonb NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_975c2db59c65c05fd9c6b63a2ab" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_seq" SERIAL NOT NULL, "customer_id" uuid NOT NULL, "client_ref" uuid NOT NULL, "status" character varying(20) NOT NULL, "subtotal_paise" integer NOT NULL, "discount_paise" integer NOT NULL DEFAULT '0', "delivery_fee_paise" integer NOT NULL DEFAULT '0', "gift_wrap_paise" integer NOT NULL DEFAULT '0', "total_paise" integer NOT NULL, "coupon_code" character varying(30), "gift_wrap" boolean NOT NULL DEFAULT false, "gift_message" text NOT NULL DEFAULT '', "engraving" character varying(30) NOT NULL DEFAULT '', "ship_name" character varying(120) NOT NULL, "ship_phone" character varying(14) NOT NULL, "ship_line1" character varying(200) NOT NULL, "ship_line2" character varying(200) NOT NULL DEFAULT '', "ship_city" character varying(80) NOT NULL, "ship_state" character varying(60) NOT NULL, "ship_pincode" character varying(6) NOT NULL, "receipt_key" character varying(200), "utr" character varying(40), "paid_amount_paise" integer, "payment_submitted_at" TIMESTAMP WITH TIME ZONE, "payment_verified_at" TIMESTAMP WITH TIME ZONE, "payment_verified_by" uuid, "payment_reject_reason" text, "packed_at" TIMESTAMP WITH TIME ZONE, "carrier" character varying(60), "tracking_no" character varying(80), "shipped_at" TIMESTAMP WITH TIME ZONE, "delivered_at" TIMESTAMP WITH TIME ZONE, "cancelled_at" TIMESTAMP WITH TIME ZONE, "cancel_reason" text, "cancelled_by" character varying(10), "refund_due" boolean NOT NULL DEFAULT false, "refunded_at" TIMESTAMP WITH TIME ZONE, "refund_note" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ea859ebfa61c0b71f1bacb69a1c" UNIQUE ("customer_id", "client_ref"), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_044317fbe95661e7ae7497d482" ON "orders" ("order_seq") `);
        await queryRunner.query(`CREATE INDEX "IDX_772d0ce0473ac2ccfa26060dbe" ON "orders" ("customer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_775c9f06fc27ae3ff8fb26f2c4" ON "orders" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_5c7c1ffb7d084c5d1ceec54b21" ON "orders" ("utr") `);
        await queryRunner.query(`CREATE INDEX "IDX_c884e321f927d5b86aac7c8f9e" ON "orders" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "variant_id" uuid NOT NULL, "product_id" uuid NOT NULL, "product_slug" character varying(140) NOT NULL, "sku" character varying(40) NOT NULL, "name" character varying(140) NOT NULL, "brand" character varying(100) NOT NULL, "label" character varying(40) NOT NULL, "size_ml" integer NOT NULL, "unit_price_paise" integer NOT NULL, "qty" integer NOT NULL, "line_total_paise" integer NOT NULL, "is_free_sample" boolean NOT NULL DEFAULT false, "image_key" character varying(200), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_145532db85752b29c57d2b7b1f" ON "order_items" ("order_id") `);
        await queryRunner.query(`CREATE TABLE "order_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "order_id" uuid NOT NULL, "from_status" character varying(20), "to_status" character varying(20) NOT NULL, "actor_type" character varying(10) NOT NULL, "actor_id" uuid, "note" text, "meta" jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cc1b82b0fcf1be577d9d7ecbf8b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b33cbf9a59cbee112d94bcb59d" ON "order_events" ("order_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_36bbf4b79da9c0e9da199b9afa" ON "order_events" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(30) NOT NULL, "description" character varying(120) NOT NULL DEFAULT '', "type" character varying(8) NOT NULL, "value" integer NOT NULL, "min_order_paise" integer NOT NULL DEFAULT '0', "max_discount_paise" integer, "starts_at" TIMESTAMP WITH TIME ZONE, "ends_at" TIMESTAMP WITH TIME ZONE, "max_uses" integer, "per_customer_limit" integer NOT NULL DEFAULT '1', "used_count" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying(14) NOT NULL, "name" character varying(120) NOT NULL DEFAULT '', "email" character varying(254) NOT NULL DEFAULT '', "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_88acd889fbe17d0e16cc4bc9174" UNIQUE ("phone"), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "customer_addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "label" character varying(30) NOT NULL DEFAULT '', "name" character varying(120) NOT NULL, "phone" character varying(14) NOT NULL, "line1" character varying(200) NOT NULL, "line2" character varying(200) NOT NULL DEFAULT '', "city" character varying(80) NOT NULL, "state" character varying(60) NOT NULL, "pincode" character varying(6) NOT NULL, "is_default" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_336bda7b0a0cd04241f719fc834" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6be4e1a698f5c3f2c2e4c75c18" ON "customer_addresses" ("customer_id") `);
        await queryRunner.query(`CREATE TABLE "customer_otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying(14) NOT NULL, "code_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "consumed_at" TIMESTAMP WITH TIME ZONE, "ip" character varying(64), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_291c1c28ac460b417de185f0a2b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_ae04d2939724745cce204b27fa" ON "customer_otps" ("phone") `);
        await queryRunner.query(`CREATE INDEX "IDX_573edd97712e0ce54341a950e9" ON "customer_otps" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "customer_refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "ip" character varying(64), "user_agent" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_db450cd4bbe1b7ca4c36762c777" UNIQUE ("token_hash"), CONSTRAINT "PK_a0872102f2c477ecc4264a1bc93" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_64ee8c9d54275883c6068e70a1" ON "customer_refresh_tokens" ("customer_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_8a4cb496b129f22e9383798fec" ON "customer_refresh_tokens" ("family_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_9920e669de31d00f955a117d16" ON "customer_refresh_tokens" ("expires_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_9920e669de31d00f955a117d16"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8a4cb496b129f22e9383798fec"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_64ee8c9d54275883c6068e70a1"`);
        await queryRunner.query(`DROP TABLE "customer_refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_573edd97712e0ce54341a950e9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ae04d2939724745cce204b27fa"`);
        await queryRunner.query(`DROP TABLE "customer_otps"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6be4e1a698f5c3f2c2e4c75c18"`);
        await queryRunner.query(`DROP TABLE "customer_addresses"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`DROP TABLE "coupons"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_36bbf4b79da9c0e9da199b9afa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b33cbf9a59cbee112d94bcb59d"`);
        await queryRunner.query(`DROP TABLE "order_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_145532db85752b29c57d2b7b1f"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c884e321f927d5b86aac7c8f9e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5c7c1ffb7d084c5d1ceec54b21"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_775c9f06fc27ae3ff8fb26f2c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_772d0ce0473ac2ccfa26060dbe"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_044317fbe95661e7ae7497d482"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TABLE "app_settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_648a219189cabaaf46c450409f"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_559aa6c5989dd2d37c8003f6be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ddc65377c6f0d49e0424b2385d"`);
        await queryRunner.query(`DROP TABLE "whatsapp_messages"`);
    }

}
