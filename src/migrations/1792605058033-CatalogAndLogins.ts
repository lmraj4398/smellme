import { MigrationInterface, QueryRunner } from "typeorm";

export class CatalogAndLogins1792605058033 implements MigrationInterface {
    name = 'CatalogAndLogins1792605058033'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "api_error_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "group_key" character varying(200) NOT NULL, "group_label" character varying(200) NOT NULL, "severity" character varying(10) NOT NULL, "status_code" integer NOT NULL, "method" character varying(10) NOT NULL, "url" text NOT NULL, "request_query" text, "request_body" text, "message" text NOT NULL, "user_id" character varying(64), "user_type" character varying(20), "screen" character varying(200), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_fba47c85f9649de5fcf2f527739" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_9970608b39923c779c7700146d" ON "api_error_logs" ("group_key") `);
        await queryRunner.query(`CREATE INDEX "IDX_2501ddd341a9cff717a7e30abf" ON "api_error_logs" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "brands" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "slug" character varying(120) NOT NULL, "is_original" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_96db6bbbaa6f23cad26871339b6" UNIQUE ("name"), CONSTRAINT "UQ_b15428f362be2200922952dc268" UNIQUE ("slug"), CONSTRAINT "PK_b0c437120b624da1034a81fc561" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "scent_families" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60) NOT NULL, "slug" character varying(80) NOT NULL, "tint" character varying(7) NOT NULL DEFAULT '#F3E6D6', "ink" character varying(7) NOT NULL DEFAULT '#9A6A2E', "notes_hint" character varying(120) NOT NULL DEFAULT '', "sort_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_89ac4c804dff27176ef231a2cdd" UNIQUE ("name"), CONSTRAINT "UQ_6518c7cc6f67ea39a7bbfd5d5b9" UNIQUE ("slug"), CONSTRAINT "PK_7a359dbd13b9f8e7af75a822a23" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60) NOT NULL, "color" character varying(7) NOT NULL DEFAULT '#E8B46A', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_642d9663b6a9fe56f7a393ec0bb" UNIQUE ("name"), CONSTRAINT "PK_af6206538ea96c4e77e9f400c3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "products" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(140) NOT NULL, "name" character varying(140) NOT NULL, "brand_id" uuid NOT NULL, "family_id" uuid NOT NULL, "descriptors" character varying(80) NOT NULL DEFAULT '', "concentration" character varying(12) NOT NULL, "gender" character varying(10) NOT NULL, "short_description" text NOT NULL DEFAULT '', "story" text NOT NULL DEFAULT '', "how_to_wear" text NOT NULL DEFAULT '', "ingredients" text NOT NULL DEFAULT '', "badge" character varying(30) NOT NULL DEFAULT '', "tint" character varying(7) NOT NULL DEFAULT '#F3E6D6', "liquid" character varying(7) NOT NULL DEFAULT '#D7A260', "mono" character varying(4) NOT NULL DEFAULT '', "longevity_label" character varying(40) NOT NULL DEFAULT '', "longevity_level" smallint NOT NULL DEFAULT '3', "projection_label" character varying(40) NOT NULL DEFAULT '', "projection_level" smallint NOT NULL DEFAULT '3', "season_label" character varying(40) NOT NULL DEFAULT '', "season_level" smallint NOT NULL DEFAULT '3', "occasion_label" character varying(40) NOT NULL DEFAULT '', "occasion_level" smallint NOT NULL DEFAULT '3', "is_active" boolean NOT NULL DEFAULT true, "is_featured" boolean NOT NULL DEFAULT false, "sort_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_464f927ae360106b783ed0b4106" UNIQUE ("slug"), CONSTRAINT "PK_0806c755e0aca124e67c0cf6d7d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_1530a6f15d3c79d1b70be98f2b" ON "products" ("brand_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_78bbdb337649eeefd5ef00a7b9" ON "products" ("family_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_995d8194c43edfc98838cabc5a" ON "products" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "product_variants" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "sku" character varying(40) NOT NULL, "label" character varying(40) NOT NULL, "size_ml" integer NOT NULL, "price_paise" integer NOT NULL, "mrp_paise" integer, "is_sample" boolean NOT NULL DEFAULT false, "stock" integer NOT NULL DEFAULT '0', "low_stock_at" integer NOT NULL DEFAULT '5', "is_active" boolean NOT NULL DEFAULT true, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_46f236f21640f9da218a063a866" UNIQUE ("sku"), CONSTRAINT "PK_281e3f2c55652d6a22c0aa59fd7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_6343513e20e2deab45edfce131" ON "product_variants" ("product_id") `);
        await queryRunner.query(`CREATE TABLE "product_notes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "note_id" uuid NOT NULL, "tier" character varying(5) NOT NULL, "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "UQ_0c2e756f96dacb2b19470136964" UNIQUE ("product_id", "note_id", "tier"), CONSTRAINT "PK_2085982b3083c582b7db37738f8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f7b6e70696318a5c8d1dc021fe" ON "product_notes" ("product_id") `);
        await queryRunner.query(`CREATE TABLE "product_media" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "key" character varying(200) NOT NULL, "alt" character varying(140) NOT NULL DEFAULT '', "sort_order" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_09d4639de8082a32aa27f3ac9a6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e6bb4a69096db4f6a1f5bada15" ON "product_media" ("product_id") `);
        await queryRunner.query(`CREATE TABLE "stock_ledger" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "variant_id" uuid NOT NULL, "delta" integer NOT NULL, "balance_after" integer NOT NULL, "reason" character varying(12) NOT NULL, "note" text, "ref" character varying(60), "admin_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bb04575ee2ff52f72028f669701" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2e430b9ae5dfaaee70a25f9628" ON "stock_ledger" ("variant_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_0def5a8f767d73d98ec7491168" ON "stock_ledger" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "products" ADD CONSTRAINT "FK_78bbdb337649eeefd5ef00a7b92" FOREIGN KEY ("family_id") REFERENCES "scent_families"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "FK_6343513e20e2deab45edfce1316" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_notes" ADD CONSTRAINT "FK_f7b6e70696318a5c8d1dc021fe4" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_notes" ADD CONSTRAINT "FK_d572251339880235ec917b151ea" FOREIGN KEY ("note_id") REFERENCES "notes"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "product_media" ADD CONSTRAINT "FK_e6bb4a69096db4f6a1f5bada151" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "stock_ledger" ADD CONSTRAINT "FK_2e430b9ae5dfaaee70a25f96284" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stock_ledger" DROP CONSTRAINT "FK_2e430b9ae5dfaaee70a25f96284"`);
        await queryRunner.query(`ALTER TABLE "product_media" DROP CONSTRAINT "FK_e6bb4a69096db4f6a1f5bada151"`);
        await queryRunner.query(`ALTER TABLE "product_notes" DROP CONSTRAINT "FK_d572251339880235ec917b151ea"`);
        await queryRunner.query(`ALTER TABLE "product_notes" DROP CONSTRAINT "FK_f7b6e70696318a5c8d1dc021fe4"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_6343513e20e2deab45edfce1316"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_78bbdb337649eeefd5ef00a7b92"`);
        await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0def5a8f767d73d98ec7491168"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2e430b9ae5dfaaee70a25f9628"`);
        await queryRunner.query(`DROP TABLE "stock_ledger"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e6bb4a69096db4f6a1f5bada15"`);
        await queryRunner.query(`DROP TABLE "product_media"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f7b6e70696318a5c8d1dc021fe"`);
        await queryRunner.query(`DROP TABLE "product_notes"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_6343513e20e2deab45edfce131"`);
        await queryRunner.query(`DROP TABLE "product_variants"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_995d8194c43edfc98838cabc5a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_78bbdb337649eeefd5ef00a7b9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1530a6f15d3c79d1b70be98f2b"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TABLE "notes"`);
        await queryRunner.query(`DROP TABLE "scent_families"`);
        await queryRunner.query(`DROP TABLE "brands"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2501ddd341a9cff717a7e30abf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9970608b39923c779c7700146d"`);
        await queryRunner.query(`DROP TABLE "api_error_logs"`);
    }

}
