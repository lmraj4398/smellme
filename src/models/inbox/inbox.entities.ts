import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const CONTACT_TOPICS = [
  'Help choosing a fragrance',
  'An order I placed',
  'Returns & refunds',
  'Corporate or wedding gifting',
  'Something else',
] as const;

@Entity('contact_messages')
export class ContactMessage {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 30, default: '' }) phone: string;
  @Column({ type: 'varchar', length: 254, default: '' }) email: string;
  @Column({ type: 'varchar', length: 60 }) topic: string;
  @Column({ type: 'text' }) message: string;
  @Index() @Column({ type: 'bool', default: false }) is_read: boolean;
  @Index() @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}

@Entity('newsletter_subscribers')
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn('uuid') id: string;
  // Stored lowercased; one row per address.
  @Column({ type: 'varchar', length: 254, unique: true }) email: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
