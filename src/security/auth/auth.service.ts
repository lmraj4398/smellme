import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomUUID } from 'crypto';
import { IsNull, LessThan, Repository } from 'typeorm';
import { AdminUser, AdminUserDto, toAdminUserDto } from '../../models/admin-users/admin-user.entity';
import { RefreshToken } from '../token/refresh-token.entity';
import { hashPassword, verifyPassword } from './password';

export interface ClientMeta {
  ip?: string;
  userAgent?: string;
}

export interface Session {
  token: string; // short-lived access JWT, returned in the body
  refreshToken: string; // opaque, goes in the httpOnly cookie only
  user: AdminUserDto;
}

// A refresh token presented again moments after rotation is almost always two
// requests racing (e.g. two tabs), not theft - refuse it without nuking the
// session. Beyond this window, reuse means a stale copy was replayed.
const REUSE_GRACE_MS = 10_000;

const BAD_LOGIN = 'Invalid email or password';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(AdminUser) private readonly users: Repository<AdminUser>,
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  get refreshDays(): number {
    return this.config.get<number>('REFRESH_TOKEN_EXPIRY_DAYS', 30);
  }

  async login(email: string, password: string, meta: ClientMeta): Promise<Session> {
    const user = await this.users.findOne({ where: { email } });
    const ok = await verifyPassword(password, user?.password_hash ?? null);
    // One message and one code path for unknown email, wrong password and a
    // disabled account, so the response never reveals which of them it was.
    if (!user || !ok || !user.is_active) throw new UnauthorizedException(BAD_LOGIN);

    await this.users.update(user.id, { last_login_at: new Date() });
    return this.issue(user, meta, randomUUID());
  }

  async refresh(raw: string | undefined, meta: ClientMeta): Promise<Session> {
    if (!raw) throw new UnauthorizedException('Unauthorized');
    const row = await this.tokens.findOne({ where: { token_hash: this.hash(raw) } });
    if (!row) throw new UnauthorizedException('Unauthorized');

    if (row.revoked_at) {
      if (Date.now() - row.revoked_at.getTime() > REUSE_GRACE_MS) {
        // An already-rotated token came back: assume it leaked and end every session of this family.
        await this.revokeFamily(row.family_id);
        this.logger.warn(`Refresh token reuse detected for user ${row.user_id}; family revoked`);
      }
      throw new UnauthorizedException('Unauthorized');
    }
    if (row.expires_at.getTime() <= Date.now()) throw new UnauthorizedException('Unauthorized');

    const user = await this.users.findOne({ where: { id: row.user_id } });
    if (!user || !user.is_active) throw new UnauthorizedException('Unauthorized');

    // Single-use: revoke only if still active, so two racing requests can't both win.
    const claimed = await this.tokens.update({ id: row.id, revoked_at: IsNull() }, { revoked_at: new Date() });
    if (!claimed.affected) throw new UnauthorizedException('Unauthorized');

    return this.issue(user, meta, row.family_id);
  }

  async logout(raw: string | undefined): Promise<void> {
    if (!raw) return;
    await this.tokens.update({ token_hash: this.hash(raw), revoked_at: IsNull() }, { revoked_at: new Date() });
  }

  async me(userId: string): Promise<AdminUserDto> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.is_active) throw new UnauthorizedException('Unauthorized');
    return toAdminUserDto(user);
  }

  async changePassword(userId: string, current: string, next: string, meta: ClientMeta): Promise<Session> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.is_active) throw new UnauthorizedException('Unauthorized');
    if (!(await verifyPassword(current, user.password_hash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.users.update(user.id, { password_hash: await hashPassword(next) });
    // Every other device is signed out; this one gets a fresh session.
    await this.tokens.update({ user_id: user.id, revoked_at: IsNull() }, { revoked_at: new Date() });
    return this.issue(user, meta, randomUUID());
  }

  async purgeExpired(): Promise<number> {
    const res = await this.tokens.delete({ expires_at: LessThan(new Date(Date.now() - 7 * 24 * 3600 * 1000)) });
    return res.affected ?? 0;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async issue(user: AdminUser, meta: ClientMeta, familyId: string): Promise<Session> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.tokens.insert({
      user_id: user.id,
      family_id: familyId,
      token_hash: this.hash(refreshToken),
      expires_at: new Date(Date.now() + this.refreshDays * 24 * 3600 * 1000),
      ip: meta.ip?.slice(0, 64) ?? null,
      user_agent: meta.userAgent?.slice(0, 300) ?? null,
    });
    const token = await this.jwt.signAsync({ sub: user.id, typ: 'admin', screens: user.allowed_screens });
    return { token, refreshToken, user: toAdminUserDto(user) };
  }

  private revokeFamily(familyId: string) {
    return this.tokens.update({ family_id: familyId, revoked_at: IsNull() }, { revoked_at: new Date() });
  }

  // Keyed hash: a leaked table of hashes can't be matched against guessed tokens without the secret.
  private hash(raw: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_REFRESH_SECRET')).update(raw).digest('hex');
  }
}
