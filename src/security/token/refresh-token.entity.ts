import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  user_id: string;

  // All tokens descended from one login share a family, so reuse of a stolen,
  // already-rotated token can revoke the whole chain.
  @Index()
  @Column({ type: 'uuid' })
  family_id: string;

  // HMAC-SHA256 of the opaque token. The raw value exists only in the cookie.
  @Column({ type: 'varchar', length: 64, unique: true })
  token_hash: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revoked_at: Date | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  user_agent: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
