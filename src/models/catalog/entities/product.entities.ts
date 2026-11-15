import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn,
} from 'typeorm';
import { Brand, Note, ScentFamily } from './taxonomy.entities';

export const CONCENTRATIONS = ['extrait', 'edp', 'edt', 'attar', 'mist'] as const;
export const GENDERS = ['women', 'men', 'unisex'] as const;
export const NOTE_TIERS = ['top', 'heart', 'base'] as const;
export type Concentration = (typeof CONCENTRATIONS)[number];
export type Gender = (typeof GENDERS)[number];
export type NoteTier = (typeof NOTE_TIERS)[number];

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', length: 140, unique: true }) slug: string;
  @Column({ type: 'varchar', length: 140 }) name: string;

  @Index() @Column({ type: 'uuid' }) brand_id: string;
  @ManyToOne(() => Brand, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'brand_id' })
  brand: Brand;

  @Index() @Column({ type: 'uuid' }) family_id: string;
  @ManyToOne(() => ScentFamily, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'family_id' })
  family: ScentFamily;

  // Card subtitle, e.g. "Amber · Spicy".
  @Column({ type: 'varchar', length: 80, default: '' }) descriptors: string;
  @Column({ type: 'varchar', length: 12 }) concentration: Concentration;
  @Column({ type: 'varchar', length: 10 }) gender: Gender;

  @Column({ type: 'text', default: '' }) short_description: string;
  @Column({ type: 'text', default: '' }) story: string;
  @Column({ type: 'text', default: '' }) how_to_wear: string;
  @Column({ type: 'text', default: '' }) ingredients: string;

  // "New", "Bestseller", "Exclusive" ... shown on the card. Empty = none.
  @Column({ type: 'varchar', length: 30, default: '' }) badge: string;

  // Illustrated-bottle colours, used until/unless real photos exist.
  @Column({ type: 'varchar', length: 7, default: '#F3E6D6' }) tint: string;
  @Column({ type: 'varchar', length: 7, default: '#D7A260' }) liquid: string;
  @Column({ type: 'varchar', length: 4, default: '' }) mono: string;

  // Profile meters on the product page: a label and a 1-5 level each.
  @Column({ type: 'varchar', length: 40, default: '' }) longevity_label: string;
  @Column({ type: 'smallint', default: 3 }) longevity_level: number;
  @Column({ type: 'varchar', length: 40, default: '' }) projection_label: string;
  @Column({ type: 'smallint', default: 3 }) projection_level: number;
  @Column({ type: 'varchar', length: 40, default: '' }) season_label: string;
  @Column({ type: 'smallint', default: 3 }) season_level: number;
  @Column({ type: 'varchar', length: 40, default: '' }) occasion_label: string;
  @Column({ type: 'smallint', default: 3 }) occasion_level: number;

  @Column({ type: 'bool', default: true }) is_active: boolean;
  @Column({ type: 'bool', default: false }) is_featured: boolean;
  @Column({ type: 'int', default: 0 }) sort_order: number;

  @OneToMany(() => ProductVariant, (v) => v.product) variants: ProductVariant[];
  @OneToMany(() => ProductNote, (n) => n.product) notes: ProductNote[];
  @OneToMany(() => ProductMedia, (m) => m.product) media: ProductMedia[];

  @Index() @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

// A purchasable size: 2 ml sample, 10 ml travel, 50 ml bottle...
// Variants are never deleted once created (orders will reference them); retire with is_active=false.
@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'uuid' }) product_id: string;
  @ManyToOne(() => Product, (p) => p.variants, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 40, unique: true }) sku: string;
  @Column({ type: 'varchar', length: 40 }) label: string;
  @Column({ type: 'int' }) size_ml: number;

  // Integer paise, always. Never floats.
  @Column({ type: 'int' }) price_paise: number;
  @Column({ type: 'int', nullable: true }) mrp_paise: number | null;

  @Column({ type: 'bool', default: false }) is_sample: boolean;

  // On-hand units. Only ever changed through StockService, which writes the ledger in the same transaction.
  @Column({ type: 'int', default: 0 }) stock: number;
  @Column({ type: 'int', default: 5 }) low_stock_at: number;

  @Column({ type: 'bool', default: true }) is_active: boolean;
  @Column({ type: 'int', default: 0 }) sort_order: number;
}

@Entity('product_notes')
@Unique(['product_id', 'note_id', 'tier'])
export class ProductNote {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'uuid' }) product_id: string;
  @ManyToOne(() => Product, (p) => p.notes, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'uuid' }) note_id: string;
  @ManyToOne(() => Note, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'note_id' })
  note: Note;

  @Column({ type: 'varchar', length: 5 }) tier: NoteTier;
  @Column({ type: 'int', default: 0 }) sort_order: number;
}

@Entity('product_media')
export class ProductMedia {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'uuid' }) product_id: string;
  @ManyToOne(() => Product, (p) => p.media, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // Object key in the public R2 bucket (media/<uuid>.<ext>).
  @Column({ type: 'varchar', length: 200 }) key: string;
  @Column({ type: 'varchar', length: 140, default: '' }) alt: string;
  @Column({ type: 'int', default: 0 }) sort_order: number;
}

export const STOCK_REASONS = ['opening', 'purchase', 'sale', 'return', 'adjustment', 'damage'] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

// Append-only. stock on the variant is the running total of these rows.
@Entity('stock_ledger')
export class StockLedger {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'uuid' }) variant_id: string;
  @ManyToOne(() => ProductVariant, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant;

  @Column({ type: 'int' }) delta: number;
  @Column({ type: 'int' }) balance_after: number;
  @Column({ type: 'varchar', length: 12 }) reason: StockReason;
  @Column({ type: 'text', nullable: true }) note: string | null;
  // Order number etc. for system-made rows.
  @Column({ type: 'varchar', length: 60, nullable: true }) ref: string | null;
  @Column({ type: 'uuid', nullable: true }) admin_id: string | null;

  @Index() @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
