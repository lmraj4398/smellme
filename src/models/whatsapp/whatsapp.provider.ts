import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OutboundMessage {
  /** Digits only with country code, e.g. 919876543210. */
  to: string;
  templateId: string;
  params: string[];
}
export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}
export interface WhatsAppProvider {
  readonly name: string;
  send(m: OutboundMessage): Promise<SendResult>;
}
export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');

// Same endpoint and payload as Pattas360's working integration: Gupshup's template-send API,
// form-encoded, with the API key in an `apikey` header.
const GUPSHUP_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';
const RETRY_DELAYS_MS = [500, 1500];
const TIMEOUT_MS = 10_000;

export class GupshupProvider implements WhatsAppProvider {
  readonly name = 'gupshup';
  private readonly logger = new Logger('GupshupProvider');

  constructor(private readonly config: ConfigService) {}

  async send(m: OutboundMessage): Promise<SendResult> {
    const body = new URLSearchParams({
      channel: 'whatsapp',
      source: this.config.getOrThrow<string>('GUPSHUP_SOURCE_NUMBER'),
      destination: m.to,
      'src.name': this.config.get<string>('GUPSHUP_APP_NAME', ''),
      template: JSON.stringify({ id: m.templateId, params: m.params }),
    });
    let last = 'Unknown error';
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const res = await fetch(GUPSHUP_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', apikey: this.config.getOrThrow<string>('GUPSHUP_API_KEY') },
          body: body.toString(),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const data = (await res.json().catch(() => null)) as { status?: string; message?: string; messageId?: string } | null;
        if (res.ok && data?.status !== 'error') return { ok: true, messageId: data?.messageId };
        last = `HTTP ${res.status}: ${data?.message ?? 'send failed'}`;
        // Only server errors and rate limiting are worth repeating; a 4xx will fail the same way again.
        if (!(res.status >= 500 || res.status === 429)) break;
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
      }
      if (attempt < RETRY_DELAYS_MS.length) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
    this.logger.warn(`Gupshup send failed: ${last}`);
    return { ok: false, error: last };
  }
}

/** Development only: prints the message instead of sending it, so the OTP flow can be tried locally. */
export class ConsoleProvider implements WhatsAppProvider {
  readonly name = 'console';
  private readonly logger = new Logger('WhatsApp[console]');
  async send(m: OutboundMessage): Promise<SendResult> {
    this.logger.warn(`to=${m.to} template=${m.templateId} params=${JSON.stringify(m.params)}`);
    return { ok: true, messageId: 'console' };
  }
}

/** Production without credentials: fail loudly instead of pretending to send. */
export class UnconfiguredProvider implements WhatsAppProvider {
  readonly name = 'unconfigured';
  async send(): Promise<SendResult> {
    return { ok: false, error: 'WhatsApp is not configured (set GUPSHUP_API_KEY, GUPSHUP_SOURCE_NUMBER, GUPSHUP_APP_NAME)' };
  }
}
