import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthedAdmin, CurrentAdmin } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService, ClientMeta, Session } from './auth.service';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto';
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './refresh-cookie.util';

const meta = (req: Request): ClientMeta => ({ ip: req.ip, userAgent: req.headers['user-agent'] });

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // The refresh token goes in the cookie and never in the body, so page
  // JavaScript (and any XSS in it) can't read it.
  private respond(res: Response, s: Session) {
    setRefreshCookie(res, s.refreshToken, this.auth.refreshDays);
    return { token: s.token, user: s.user };
  }

  // IP-level brute-force limiting is applied before routing (see rate-limits.ts).
  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.login(dto.email, dto.password, meta(req)));
  }

  // Public because the access token has usually expired by the time this is called.
  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.respond(res, await this.auth.refresh(readRefreshCookie(req), meta(req)));
    } catch (e) {
      clearRefreshCookie(res);
      throw e;
    }
  }

  @Public()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readRefreshCookie(req));
    clearRefreshCookie(res);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentAdmin() admin: AuthedAdmin) {
    return this.auth.me(admin.id);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('change-password')
  async changePassword(
    @CurrentAdmin() admin: AuthedAdmin,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.changePassword(admin.id, dto.current_password, dto.new_password, meta(req)));
  }
}
