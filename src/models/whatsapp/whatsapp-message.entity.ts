import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export const WHATSAPP_EVENTS = ['otp', 'order_placed', 'payment_approved', 'payment_rejected', 'shipped', 'delivered', 'cancelled'] as const;
export type WhatsAppEvent = (typeof WHATSAPP_EVENTS)[number];

// One row per message we tried to send. 'skipped' = no template is configured for that event
// (so nothing was attempted), which is different from a delivery that failed.
@Entity('whatsapp_messages')
export class WhatsAppMessage {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Index() @Column({ type: 'varchar', length: 30 }) event: WhatsAppEvent;
  // Stored masked (••••••3210): the log must not become a phone-number list.
  @Column({ type: 'varchar', length: 20 }) to_masked: string;
  @Column({ type: 'varchar', length: 80, default: '' }) template_id: string;
  // Never contains an OTP: params of the 'otp' event are stored as ["[redacted]"].
  @Column({ type: 'jsonb' }) params: string[];

  @Index() @Column({ type: 'varchar', length: 10 }) status: 'sent' | 'failed' | 'skipped';
  @Column({ type: 'varchar', length: 120, nullable: true }) provider_message_id: string | null;
  @Column({ type: 'text', nullable: true }) error: string | null;
  // Order number etc. so the log can be searched from an order.
  @Column({ type: 'varchar', length: 40, nullable: true }) ref: string | null;

  @Index() @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
