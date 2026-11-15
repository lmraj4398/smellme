import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('api_error_logs')
export class ApiErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Groups repeats of the same failure (Controller.handler) for the admin viewer.
  @Index()
  @Column({ type: 'varchar', length: 200 })
  group_key: string;

  @Column({ type: 'varchar', length: 200 })
  group_label: string;

  @Column({ type: 'varchar', length: 10 })
  severity: 'error' | 'warning';

  @Column({ type: 'int' })
  status_code: number;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'text', nullable: true })
  request_query: string | null;

  // Sensitive keys (passwords, OTPs, tokens) are redacted before this is stored.
  @Column({ type: 'text', nullable: true })
  request_body: string | null;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  user_type: 'admin' | 'customer' | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  screen: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
