import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Stored upper-case; matching is case-insensitive.
  @Column({ type: 'varchar', length: 30, unique: true }) code: string;
  @Column({ type: 'varchar', length: 120, default: '' }) description: string;
  @Column({ type: 'varchar', length: 8 }) type: 'percent' | 'flat';
  // percent: 1-100.  flat: paise.
  @Column({ type: 'int' }) value: number;
  @Column({ type: 'int', default: 0 }) min_order_paise: number;
  // Caps a percent discount (e.g. 10% off up to ₹500). Null = no cap.
  @Column({ type: 'int', nullable: true }) max_discount_paise: number | null;
  @Column({ type: 'timestamptz', nullable: true }) starts_at: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) ends_at: Date | null;
  @Column({ type: 'int', nullable: true }) max_uses: number | null;
  @Column({ type: 'int', default: 1 }) per_customer_limit: number;
  @Column({ type: 'int', default: 0 }) used_count: number;
  @Column({ type: 'bool', default: true }) is_active: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
