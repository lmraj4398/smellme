import { MigrationInterface, QueryRunner } from "typeorm";

export class Reviews1792630000000 implements MigrationInterface {
    name = 'Reviews1792630000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "product_reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "customer_id" uuid NOT NULL, "rating" smallint NOT NULL, "title" character varying(80) NOT NULL DEFAULT '', "body" character varying(1500) NOT NULL DEFAULT '', "status" character varying(10) NOT NULL DEFAULT 'published', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_product_reviews_customer_product" UNIQUE ("customer_id", "product_id"), CONSTRAINT "PK_product_reviews_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_product_reviews_product_status" ON "product_reviews" ("product_id", "status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_product_reviews_product_status"`);
        await queryRunner.query(`DROP TABLE "product_reviews"`);
    }
}
