import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792602431473 implements MigrationInterface {
    name = 'InitialSchema1792602431473'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admin_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(254) NOT NULL, "password_hash" character varying(100) NOT NULL, "allowed_screens" text array, "is_active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_dcd0c8a4b10af9c986e510b9ecc" UNIQUE ("email"), CONSTRAINT "PK_06744d221bb6145dc61e5dc441d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "admin_refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "family_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "ip" character varying(64), "user_agent" character varying(300), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_2e410bc860adf1f2c9d679a53b1" UNIQUE ("token_hash"), CONSTRAINT "PK_341c4a1fa29fa0017ed8ad0791f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_48504c492aa684c7dd3b2a8e83" ON "admin_refresh_tokens" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4aa7e3737b52bd9701350218ee" ON "admin_refresh_tokens" ("family_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_626d24b154b84b3f516d8bea6e" ON "admin_refresh_tokens" ("expires_at") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_626d24b154b84b3f516d8bea6e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4aa7e3737b52bd9701350218ee"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48504c492aa684c7dd3b2a8e83"`);
        await queryRunner.query(`DROP TABLE "admin_refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "admin_users"`);
    }

}
