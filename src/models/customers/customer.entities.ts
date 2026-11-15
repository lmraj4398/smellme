import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Canonical "+91XXXXXXXXXX". The phone IS the identity: it is proven by a WhatsApp OTP.
  @Column({ type: 'varchar', length: 14, unique: true }) phone: string;
  @Column({ type: 'varchar', length: 120, default: '' }) name: string;
  @Column({ type: 'varchar', length: 254, default: '' }) email: string;
  // 'YYYY-MM-DD'. Optional: for the birthday sample the shop promises.
  @Column({ type: 'date', nullable: true }) birthday: string | null;
  @Column({ type: 'timestamptz', nullable: true }) last_login_at: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('customer_addresses')
export class CustomerAddress {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) customer_id: string;
  @Column({ type: 'varchar', length: 30, default: '' }) label: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 14 }) phone: string;
  @Column({ type: 'varchar', length: 200 }) line1: string;
  @Column({ type: 'varchar', length: 200, default: '' }) line2: string;
  @Column({ type: 'varchar', length: 80 }) city: string;
  @Column({ type: 'varchar', length: 60 }) state: string;
  @Column({ type: 'varchar', length: 6 }) pincode: string;
  @Column({ type: 'bool', default: false }) is_default: boolean;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

// A one-time code. Only a keyed hash is stored, so a database leak does not reveal live codes.
@Entity('customer_otps')
export class CustomerOtp {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'varchar', length: 14 }) phone: string;
  @Column({ type: 'varchar', length: 64 }) code_hash: string;
  @Column({ type: 'timestamptz' }) expires_at: Date;
  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ type: 'timestamptz', nullable: true }) consumed_at: Date | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip: string | null;
  @Index() @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('customer_refresh_tokens')
export class CustomerRefreshToken {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'uuid' }) customer_id: string;
  @Index() @Column({ type: 'uuid' }) family_id: string;
  @Column({ type: 'varchar', length: 64, unique: true }) token_hash: string;
  @Index() @Column({ type: 'timestamptz' }) expires_at: Date;
  @Column({ type: 'timestamptz', nullable: true }) revoked_at: Date | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) ip: string | null;
  @Column({ type: 'varchar', length: 300, nullable: true }) user_agent: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
