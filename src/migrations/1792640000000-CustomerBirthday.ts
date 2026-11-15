import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomerBirthday1792640000000 implements MigrationInterface {
    name = 'CustomerBirthday1792640000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" ADD "birthday" date`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN "birthday"`);
    }
}
