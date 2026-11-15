import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export const REVIEW_STATUSES = ['published', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// One review per customer per product, written only by someone whose order for it was delivered (checked in the
// service). No foreign keys, like the rest of the schema. 'hidden' is the owner's moderation switch: the row is kept
// but never shown or counted.
@Entity('product_reviews')
@Unique('UQ_product_reviews_customer_product', ['customer_id', 'product_id'])
@Index('IDX_product_reviews_product_status', ['product_id', 'status'])
export class ProductReview {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_product_reviews_id' }) id: string;
  @Column({ type: 'uuid' }) product_id: string;
  @Column({ type: 'uuid' }) customer_id: string;
  @Column({ type: 'smallint' }) rating: number;
  @Column({ type: 'varchar', length: 80, default: '' }) title: string;
  @Column({ type: 'varchar', length: 1500, default: '' }) body: string;
  @Column({ type: 'varchar', length: 10, default: 'published' }) status: ReviewStatus;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
