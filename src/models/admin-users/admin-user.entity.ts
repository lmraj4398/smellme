import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// There is a single role. Every login is an "admin"; the only restriction is
// the optional allowed_screens list (null = every screen, i.e. the owner).
@Entity('admin_users')
export class AdminUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  // Stored lowercased; unique.
  @Column({ type: 'varchar', length: 254, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  password_hash: string;

  // Screen keys this login may use (see api @Screen() and admin NAV). null = all.
  @Column({ type: 'text', array: true, nullable: true })
  allowed_screens: string[] | null;

  @Column({ type: 'bool', default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

export interface AdminUserDto {
  id: string;
  name: string;
  email: string;
  screens: string[] | null;
}

// The only shape that ever leaves the API: never the hash.
export const toAdminUserDto = (u: AdminUser): AdminUserDto => ({
  id: u.id,
  name: u.name,
  email: u.email,
  screens: u.allowed_screens,
});
