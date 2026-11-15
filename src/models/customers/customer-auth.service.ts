import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { normalizeIndianMobile } from '../../common/utils/phone';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Customer, CustomerOtp, CustomerRefreshToken } from './customer.entities';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_AFTER_S = 30;
const OTP_MAX_SENDS = 3; // per phone per 10 minutes
const OTP_SEND_WINDOW_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5; // wrong guesses per code
const REUSE_GRACE_MS = 10_000;

export interface ClientMeta { ip?: string; userAgent?: string }
export interface CustomerDto { id: string; phone: string; name: string; email: string; birthday: string | null }
export interface CustomerSession { token: string; refreshToken: string; customer: CustomerDto }

export const toCustomerDto = (c: Customer): CustomerDto => ({ id: c.id, phone: c.phone, name: c.name, email: c.email, birthday: c.birthday ?? null });

// 429 that carries retry_after, which the exception filter passes through to the client.
const tooMany = (message: string, retryAfter: number) =>
  new HttpException({ message, retry_after: Math.max(1, Math.ceil(retryAfter)) }, HttpStatus.TOO_MANY_REQUESTS);

@Injectable()
export class CustomerAuthService {
  private readonly logger = new Logger(CustomerAuthService.name);

  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(CustomerOtp) private readonly otps: Repository<CustomerOtp>,
    @InjectRepository(CustomerRefreshToken) private readonly tokens: Repository<CustomerRefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  get refreshDays() {
    return this.config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 30);
  }

  // ── OTP ───────────────────────────────────────────────────────────────────

  async sendOtp(rawPhone: string, meta: ClientMeta) {
    const phone = normalizeIndianMobile(rawPhone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');

    const now = Date.now();
    const recent = await this.otps.find({ where: { phone, created_at: MoreThan(new Date(now - OTP_SEND_WINDOW_MS)) }, order: { created_at: 'DESC' } });
    // Per-PHONE limits (the per-IP ones live in the rate limiter): stops someone flooding one person's WhatsApp.
    if (recent[0] && now - recent[0].created_at.getTime() < OTP_RESEND_AFTER_S * 1000) {
      throw tooMany('Please wait before asking for another code', OTP_RESEND_AFTER_S - (now - recent[0].created_at.getTime()) / 1000);
    }
    if (recent.length >= OTP_MAX_SENDS) {
      throw tooMany('Too many codes requested. Please try again later.', (OTP_SEND_WINDOW_MS - (now - recent[OTP_MAX_SENDS - 1].created_at.getTime())) / 1000);
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Only the newest code is valid: older unused ones are retired.
    await this.otps.update({ phone, consumed_at: IsNull() }, { consumed_at: new Date() });
    const row = await this.otps.save(this.otps.create({ phone, code_hash: this.hashCode(phone, code), expires_at: new Date(now + OTP_TTL_MS), ip: meta.ip?.slice(0, 64) ?? null }));

    const sent = await this.whatsapp.send('otp', phone, [code]);
    if (!sent.ok) {
      await this.otps.delete(row.id);
      this.logger.warn(`OTP could not be delivered: ${sent.error}`);
      throw new ServiceUnavailableException('We couldn’t send the code on WhatsApp right now. Please try again in a moment.');
    }
    // The answer is identical whether or not this number has an account.
    return { ok: true, expires_in: OTP_TTL_MS / 1000, resend_after: OTP_RESEND_AFTER_S };
  }

  async verifyOtp(rawPhone: string, code: string, name: string | undefined, meta: ClientMeta): Promise<CustomerSession> {
    const phone = normalizeIndianMobile(rawPhone);
    const bad = new BadRequestException('That code is incorrect or has expired');
    if (!phone || !/^\d{6}$/.test(code)) throw bad;

    const otp = await this.otps.findOne({ where: { phone, consumed_at: IsNull(), expires_at: MoreThan(new Date()) }, order: { created_at: 'DESC' } });
    // One message for no code / expired / used / too many tries / wrong, so nothing is revealed.
    if (!otp) throw bad;

    // Claim one of the code's 5 attempts BEFORE looking at the guess. It is a single conditional UPDATE,
    // so even 100 simultaneous requests share the same 5 attempts: brute-forcing a 6-digit code is
    // capped at 5 guesses per code, however the requests are timed.
    const claimedAttempt = await this.otps
      .createQueryBuilder()
      .update()
      .set({ attempts: () => 'attempts + 1' })
      .where('id = :id AND attempts < :max AND consumed_at IS NULL', { id: otp.id, max: OTP_MAX_ATTEMPTS })
      .execute();
    if (!claimedAttempt.affected) throw bad;
    if (!safeEqual(otp.code_hash, this.hashCode(phone, code))) throw bad;

    // Single use, even under two simultaneous verifies of the same (correct) code.
    const claimed = await this.otps.update({ id: otp.id, consumed_at: IsNull() }, { consumed_at: new Date() });
    if (!claimed.affected) throw bad;

    let customer = await this.customers.findOne({ where: { phone } });
    if (!customer) {
      try {
        customer = await this.customers.save(this.customers.create({ phone, name: (name ?? '').trim().slice(0, 120) }));
      } catch {
        customer = await this.customers.findOneOrFail({ where: { phone } }); // created by a parallel verify
      }
    } else if (!customer.name && name?.trim()) {
      customer.name = name.trim().slice(0, 120);
    }
    customer.last_login_at = new Date();
    await this.customers.save(customer);
    return this.issue(customer, meta, randomUUID());
  }

  // ── sessions (same design as the admin's: rotating single-use refresh token, reuse detection) ──

  async refresh(raw: string | undefined, meta: ClientMeta): Promise<CustomerSession> {
    if (!raw) throw new UnauthorizedException('Unauthorized');
    const row = await this.tokens.findOne({ where: { token_hash: this.hashToken(raw) } });
    if (!row) throw new UnauthorizedException('Unauthorized');
    if (row.revoked_at) {
      if (Date.now() - row.revoked_at.getTime() > REUSE_GRACE_MS) {
        await this.tokens.update({ family_id: row.family_id, revoked_at: IsNull() }, { revoked_at: new Date() });
      }
      throw new UnauthorizedException('Unauthorized');
    }
    if (row.expires_at.getTime() <= Date.now()) throw new UnauthorizedException('Unauthorized');
    const customer = await this.customers.findOne({ where: { id: row.customer_id } });
    if (!customer) throw new UnauthorizedException('Unauthorized');
    const claimed = await this.tokens.update({ id: row.id, revoked_at: IsNull() }, { revoked_at: new Date() });
    if (!claimed.affected) throw new UnauthorizedException('Unauthorized');
    return this.issue(customer, meta, row.family_id);
  }

  async logout(raw: string | undefined) {
    if (raw) await this.tokens.update({ token_hash: this.hashToken(raw), revoked_at: IsNull() }, { revoked_at: new Date() });
  }

  async purgeExpired() {
    await this.otps.delete({ expires_at: LessThan(new Date(Date.now() - 24 * 3600 * 1000)) });
    return (await this.tokens.delete({ expires_at: LessThan(new Date(Date.now() - 7 * 24 * 3600 * 1000)) })).affected ?? 0;
  }

  private async issue(customer: Customer, meta: ClientMeta, family: string): Promise<CustomerSession> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.tokens.insert({
      customer_id: customer.id, family_id: family, token_hash: this.hashToken(refreshToken),
      expires_at: new Date(Date.now() + this.refreshDays * 24 * 3600 * 1000),
      ip: meta.ip?.slice(0, 64) ?? null, user_agent: meta.userAgent?.slice(0, 300) ?? null,
    });
    const token = await this.jwt.signAsync({ sub: customer.id, typ: 'customer' });
    return { token, refreshToken, customer: toCustomerDto(customer) };
  }

  // Keyed hashes: tables of hashes are useless without the server secret. The OTP hash also binds the
  // phone number, so a code issued to one number can never validate for another.
  private hashCode(phone: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_REFRESH_SECRET')).update(`otp:${phone}:${code}`).digest('hex');
  }
  private hashToken(raw: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_REFRESH_SECRET')).update(`crt:${raw}`).digest('hex');
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
