import { MigrationInterface, QueryRunner } from "typeorm";

export class Wishlist1792620000000 implements MigrationInterface {
    name = 'Wishlist1792620000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "wishlist_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "product_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_wishlist_customer_product" UNIQUE ("customer_id", "product_id"), CONSTRAINT "PK_wishlist_items_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_wishlist_items_customer_id" ON "wishlist_items" ("customer_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_wishlist_items_customer_id"`);
        await queryRunner.query(`DROP TABLE "wishlist_items"`);
    }
}
