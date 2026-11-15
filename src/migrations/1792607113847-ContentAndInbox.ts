import { MigrationInterface, QueryRunner } from "typeorm";

export class ContentAndInbox1792607113847 implements MigrationInterface {
    name = 'ContentAndInbox1792607113847'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "contact_messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "phone" character varying(30) NOT NULL DEFAULT '', "email" character varying(254) NOT NULL DEFAULT '', "topic" character varying(60) NOT NULL, "message" text NOT NULL, "is_read" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_b74f96eb2edd977ccfba6533293" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_e55d44314cdf69654a2eb6325a" ON "contact_messages" ("is_read") `);
        await queryRunner.query(`CREATE INDEX "IDX_11eb2c3d2d9e07f264907f40ef" ON "contact_messages" ("created_at") `);
        await queryRunner.query(`CREATE TABLE "newsletter_subscribers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_0dc48416511f011f7de7b2a8f83" UNIQUE ("email"), CONSTRAINT "PK_38f9333e9961b2fdb589128d19b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "site_content" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "page" character varying(30) NOT NULL, "section" character varying(40) NOT NULL, "data" jsonb NOT NULL, "updated_by" uuid, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_a81cc80566ba2627cdae73b31fe" UNIQUE ("page", "section"), CONSTRAINT "PK_a1362a1a095ab41c4347aea2c2d" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "site_content"`);
        await queryRunner.query(`DROP TABLE "newsletter_subscribers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_11eb2c3d2d9e07f264907f40ef"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e55d44314cdf69654a2eb6325a"`);
        await queryRunner.query(`DROP TABLE "contact_messages"`);
    }

}
