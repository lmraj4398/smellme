import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('app_settings')
export class AppSetting {
  @PrimaryColumn({ type: 'varchar', length: 60 }) key: string;
  @Column({ type: 'jsonb' }) value: Record<string, unknown>;
  @Column({ type: 'uuid', nullable: true }) updated_by: string | null;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
