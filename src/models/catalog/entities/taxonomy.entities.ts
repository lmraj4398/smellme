import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('brands')
export class Brand {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 100, unique: true }) name: string;
  @Column({ type: 'varchar', length: 120, unique: true }) slug: string;
  // "SmellMe Originals" - our own line, highlighted on the storefront.
  @Column({ type: 'bool', default: false }) is_original: boolean;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @Column({ type: 'bool', default: true }) is_active: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('scent_families')
export class ScentFamily {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 60, unique: true }) name: string;
  @Column({ type: 'varchar', length: 80, unique: true }) slug: string;
  // Arch-window background and lettering colour on the storefront.
  @Column({ type: 'varchar', length: 7, default: '#F3E6D6' }) tint: string;
  @Column({ type: 'varchar', length: 7, default: '#9A6A2E' }) ink: string;
  // "Rose, jasmine, tuberose"
  @Column({ type: 'varchar', length: 120, default: '' }) notes_hint: string;
  @Column({ type: 'int', default: 0 }) sort_order: number;
  @Column({ type: 'bool', default: true }) is_active: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

// An ingredient used in a fragrance pyramid (Saffron, Oud, Bergamot...).
@Entity('notes')
export class Note {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 60, unique: true }) name: string;
  @Column({ type: 'varchar', length: 7, default: '#E8B46A' }) color: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
