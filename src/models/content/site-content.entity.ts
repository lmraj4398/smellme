import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

// One row per edited section. A section with no row simply shows its built-in defaults.
@Entity('site_content')
@Unique(['page', 'section'])
export class SiteContent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 30 }) page: string;
  @Column({ type: 'varchar', length: 40 }) section: string;
  @Column({ type: 'jsonb' }) data: Record<string, unknown>;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
