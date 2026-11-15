import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { OWNER_ONLY_KEY } from '../../common/decorators/owner-only.decorator';
import { SCREEN_KEY } from '../../common/decorators/screen.decorator';
import type { AuthedAdmin } from '../../common/decorators/current-user.decorator';

interface AdminJwtPayload {
  sub: string;
  typ: string;
  screens: string[] | null;
}

// Global, deny-by-default. Every route needs a valid admin access token unless
// it is marked @Public(). Customer routes (later) are @Public() and use their
// own guard, so a customer token can never satisfy this one (typ check below).
@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthedAdmin }>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Unauthorized');

    let payload: AdminJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<AdminJwtPayload>(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }
    if (payload.typ !== 'admin' || !payload.sub) throw new UnauthorizedException('Unauthorized');

    req.user = { id: payload.sub, type: 'admin', screens: payload.screens ?? null };

    if (this.reflector.getAllAndOverride<boolean>(OWNER_ONLY_KEY, targets) && req.user.screens !== null) {
      throw new ForbiddenException('Only the owner can do this');
    }

    const screen = this.reflector.getAllAndOverride<string | undefined>(SCREEN_KEY, targets);
    if (screen && req.user.screens !== null && !req.user.screens.includes(screen)) {
      throw new ForbiddenException('You do not have access to this screen');
    }
    return true;
  }
}
