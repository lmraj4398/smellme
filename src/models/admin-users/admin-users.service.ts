import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { rethrowDbError } from '../../common/utils/db-error';
import { hashPassword } from '../../security/auth/password';
import { RefreshToken } from '../../security/token/refresh-token.entity';
import { CreateLoginDto, UpdateLoginDto } from './dto/admin-users.dto';
import { AdminUser } from './admin-user.entity';

const view = (u: AdminUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  screens: u.allowed_screens,
  is_active: u.is_active,
  last_login_at: u.last_login_at,
  created_at: u.created_at,
});

// Owner-managed logins. There is no delete (history and audit trails keep
// pointing at the id); a login is switched off with is_active = false.
@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(AdminUser) private readonly users: Repository<AdminUser>,
    @InjectRepository(RefreshToken) private readonly tokens: Repository<RefreshToken>,
  ) {}

  async list() {
    return (await this.users.find({ order: { created_at: 'ASC' } })).map(view);
  }

  async create(dto: CreateLoginDto) {
    try {
      const row = await this.users.save(
        this.users.create({
          name: dto.name,
          email: dto.email,
          password_hash: await hashPassword(dto.password),
          allowed_screens: dto.screens,
          is_active: true,
        }),
      );
      return view(row);
    } catch (e) {
      rethrowDbError(e, 'A login with this email');
    }
  }

  async update(id: string, dto: UpdateLoginDto, actorId: string) {
    const target = await this.users.findOne({ where: { id } });
    if (!target) throw new NotFoundException('Login not found');

    const changesAccess = dto.screens !== undefined || dto.is_active !== undefined;
    // Owners cannot cut their own access: it is the easiest way to lock yourself out.
    if (id === actorId && changesAccess && (dto.is_active === false || dto.screens !== undefined)) {
      throw new BadRequestException('You cannot change your own access');
    }

    const nextScreens = dto.screens !== undefined ? dto.screens : target.allowed_screens;
    const nextActive = dto.is_active ?? target.is_active;
    const wasOwner = target.is_active && target.allowed_screens === null;
    const willBeOwner = nextActive && nextScreens === null;
    if (wasOwner && !willBeOwner) {
      const otherOwners = await this.users.count({ where: { id: Not(id), is_active: true, allowed_screens: IsNull() } });
      if (!otherOwners) throw new BadRequestException('There must always be at least one active unrestricted login');
    }

    if (dto.name !== undefined) target.name = dto.name;
    target.allowed_screens = nextScreens;
    target.is_active = nextActive;
    await this.users.save(target);

    // The access token carries the screen list, so end that login's sessions: the change then
    // takes effect at its next sign-in instead of up to 15 minutes later.
    if (dto.screens !== undefined || dto.is_active === false) await this.revokeSessions(id);
    return view(target);
  }

  async resetPassword(id: string, newPassword: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Use "Change password" for your own login');
    if (!(await this.users.exists({ where: { id } }))) throw new NotFoundException('Login not found');
    await this.users.update(id, { password_hash: await hashPassword(newPassword) });
    await this.revokeSessions(id);
    return { ok: true };
  }

  private revokeSessions(userId: string) {
    return this.tokens.update({ user_id: userId, revoked_at: IsNull() }, { revoked_at: new Date() });
  }
}
