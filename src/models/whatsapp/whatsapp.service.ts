import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { maskPhone, toWhatsAppNumber } from '../../common/utils/phone';
import { isProductionEnv } from '../../common/utils/env.util';
import { WhatsAppEvent, WhatsAppMessage } from './whatsapp-message.entity';
import { WHATSAPP_PROVIDER, type WhatsAppProvider } from './whatsapp.provider';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    @Inject(WHATSAPP_PROVIDER) private readonly provider: WhatsAppProvider,
    @InjectRepository(WhatsAppMessage) private readonly log: Repository<WhatsAppMessage>,
    private readonly config: ConfigService,
  ) {}

  /** The approved Gupshup template for an event, from GUPSHUP_TEMPLATE_<EVENT>. */
  private templateFor(event: WhatsAppEvent): string {
    return this.config.get<string>(`GUPSHUP_TEMPLATE_${event.toUpperCase()}`, '') || '';
  }

  /**
   * Sends and records. Never throws. `canonicalPhone` is "+91XXXXXXXXXX".
   * Use the result where delivery matters (the OTP); everything else should use notify().
   */
  async send(event: WhatsAppEvent, canonicalPhone: string, params: string[], ref?: string): Promise<{ ok: boolean; error?: string }> {
    let template = this.templateFor(event);
    // With the console provider (development) a missing template id is fine - nothing is really sent.
    if (!template && this.provider.name === 'console') template = event;

    const base = {
      event,
      to_masked: maskPhone(canonicalPhone),
      template_id: template,
      // An OTP must never be written to a table.
      params: event === 'otp' ? ['[redacted]'] : params,
      ref: ref ?? null,
    };

    if (!template) {
      await this.record({ ...base, status: 'skipped', error: `No template configured (GUPSHUP_TEMPLATE_${event.toUpperCase()})`, provider_message_id: null });
      // OTP has no fallback: without a template nobody can sign in, so say so.
      return { ok: false, error: 'WhatsApp template not configured' };
    }

    let result;
    try {
      result = await this.provider.send({ to: toWhatsAppNumber(canonicalPhone), templateId: template, params });
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    await this.record({ ...base, status: result.ok ? 'sent' : 'failed', error: result.error ?? null, provider_message_id: result.messageId ?? null });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }

  /** Fire-and-forget for notifications: a WhatsApp outage must never fail or slow an order. */
  notify(event: WhatsAppEvent, canonicalPhone: string, params: string[], ref?: string): void {
    void this.send(event, canonicalPhone, params, ref).catch((e) => this.logger.warn(`notify(${event}) crashed: ${e}`));
  }

  private async record(row: Partial<WhatsAppMessage>) {
    try {
      await this.log.insert(row);
    } catch (e) {
      this.logger.warn(`Could not store WhatsApp log: ${(e as Error).message}`);
    }
  }

  get isProduction() {
    return isProductionEnv(process.env.NODE_ENV);
  }
}
