import { BadRequestException, Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { DataSource, Repository } from 'typeorm';
import { Public } from '../../common/decorators/public.decorator';
import { isProductionEnv } from '../../common/utils/env.util';
import { normalizeIndianMobile } from '../../common/utils/phone';
import { CustomerAuthService, toCustomerDto, type ClientMeta, type CustomerSession } from './customer-auth.service';
import { SavedAddressDto, SendOtpDto, UpdateProfileDto, VerifyOtpDto } from './customer.dto';
import { Customer, CustomerAddress } from './customer.entities';
import { CurrentCustomer, CustomerRoute, type AuthedCustomer } from './customer.guard';

const COOKIE = 'sm_crt';
const cookieOptions = (maxAge: number): CookieOptions => ({
  httpOnly: true, secure: isProductionEnv(process.env.NODE_ENV), sameSite: 'lax', path: '/api/customer', maxAge,
});
const meta = (req: Request): ClientMeta => ({ ip: req.ip, userAgent: req.headers['user-agent'] });
const refreshCookie = (req: Request): string | undefined => {
  const v = (req.cookies as Record<string, unknown> | undefined)?.[COOKIE];
  return typeof v === 'string' && v.length > 0 && v.length < 200 ? v : undefined;
};
const uuid = () => new ParseUUIDPipe({ version: '4' });
const MAX_ADDRESSES = 10;

/** A real calendar date, not in the future and not before 1900; anything else is a 400. */
function validBirthday(value: string): string {
  const d = new Date(`${value}T00:00:00Z`);
  const real = !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
  if (!real || d.getTime() > Date.now() || d.getUTCFullYear() < 1900) throw new BadRequestException('Enter a valid birth date');
  return value;
}

@ApiTags('Customer auth')
@Controller('customer')
export class CustomerAuthController {
  constructor(private readonly auth: CustomerAuthService) {}

  private respond(res: Response, s: CustomerSession) {
    res.cookie(COOKIE, s.refreshToken, cookieOptions(this.auth.refreshDays * 24 * 3600 * 1000));
    return { token: s.token, customer: s.customer };
  }

  // Per-IP limits are applied before routing; per-phone limits live in the service.
  @Public() @HttpCode(200) @Post('otp/send')
  sendOtp(@Body() dto: SendOtpDto, @Req() req: Request) { return this.auth.sendOtp(dto.phone, meta(req)); }

  @Public() @HttpCode(200) @Post('otp/verify')
  async verify(@Body() dto: VerifyOtpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.verifyOtp(dto.phone, dto.code, dto.name, meta(req)));
  }

  @Public() @HttpCode(200) @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.respond(res, await this.auth.refresh(refreshCookie(req), meta(req)));
    } catch (e) {
      res.clearCookie(COOKIE, cookieOptions(0));
      throw e;
    }
  }

  @Public() @HttpCode(200) @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshCookie(req));
    res.clearCookie(COOKIE, cookieOptions(0));
    return { ok: true };
  }
}

@ApiTags('Customer account')
@ApiBearerAuth()
@CustomerRoute()
@Controller('customer')
export class CustomerAccountController {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(CustomerAddress) private readonly addresses: Repository<CustomerAddress>,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  @Get('me')
  async me(@CurrentCustomer() c: AuthedCustomer) {
    return toCustomerDto(await this.customers.findOneByOrFail({ id: c.id }));
  }

  @Patch('me')
  async update(@CurrentCustomer() c: AuthedCustomer, @Body() dto: UpdateProfileDto) {
    const birthday = dto.birthday === undefined ? undefined : dto.birthday === '' ? null : validBirthday(dto.birthday);
    await this.customers.update(c.id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email } : {}),
      ...(birthday !== undefined ? { birthday } : {}),
    });
    return toCustomerDto(await this.customers.findOneByOrFail({ id: c.id }));
  }

  /**
   * Which scent families this customer buys, from their orders (cancelled and refunded ones and free samples left out).
   * `share` is each family's quantity relative to their most-bought one, so the top family is always 1.
   */
  @Get('me/scent-profile')
  async scentProfile(@CurrentCustomer() c: AuthedCustomer) {
    const rows: { name: string; slug: string; qty: number }[] = await this.ds.query(
      `SELECT f.name, f.slug, SUM(i.qty)::int AS qty
       FROM orders o JOIN order_items i ON i.order_id = o.id
       JOIN products p ON p.id = i.product_id JOIN scent_families f ON f.id = p.family_id
       WHERE o.customer_id = $1 AND o.status NOT IN ('CANCELLED', 'REFUNDED') AND i.is_free_sample = false
       GROUP BY f.id, f.name, f.slug ORDER BY qty DESC, f.name LIMIT 6`,
      [c.id],
    );
    const top = rows[0]?.qty ?? 1;
    return { families: rows.map((r) => ({ ...r, share: Math.round((r.qty / top) * 100) / 100 })) };
  }

  // ── addresses: every query is scoped by customer_id, so another customer's id is just "not found" ──

  @Get('addresses')
  list(@CurrentCustomer() c: AuthedCustomer) {
    return this.addresses.find({ where: { customer_id: c.id }, order: { is_default: 'DESC', created_at: 'ASC' } });
  }

  @Post('addresses')
  async create(@CurrentCustomer() c: AuthedCustomer, @Body() dto: SavedAddressDto) {
    const phone = normalizeIndianMobile(dto.phone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    return this.ds.transaction(async (m) => {
      const existing = await m.count(CustomerAddress, { where: { customer_id: c.id } });
      if (existing >= MAX_ADDRESSES) throw new BadRequestException(`You can save up to ${MAX_ADDRESSES} addresses`);
      const makeDefault = dto.is_default === true || existing === 0;
      if (makeDefault) await m.update(CustomerAddress, { customer_id: c.id }, { is_default: false });
      return m.save(CustomerAddress, m.create(CustomerAddress, { ...dto, phone, line2: dto.line2 ?? '', label: dto.label ?? '', customer_id: c.id, is_default: makeDefault }));
    });
  }

  @Put('addresses/:id')
  async replace(@CurrentCustomer() c: AuthedCustomer, @Param('id', uuid()) id: string, @Body() dto: SavedAddressDto) {
    const phone = normalizeIndianMobile(dto.phone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number');
    return this.ds.transaction(async (m) => {
      const row = await m.findOne(CustomerAddress, { where: { id, customer_id: c.id } });
      if (!row) throw new NotFoundException('Address not found');
      if (dto.is_default) await m.update(CustomerAddress, { customer_id: c.id }, { is_default: false });
      Object.assign(row, { ...dto, phone, line2: dto.line2 ?? '', label: dto.label ?? '', is_default: dto.is_default ?? row.is_default });
      return m.save(CustomerAddress, row);
    });
  }

  @Delete('addresses/:id') @HttpCode(200)
  async remove(@CurrentCustomer() c: AuthedCustomer, @Param('id', uuid()) id: string) {
    const r = await this.addresses.delete({ id, customer_id: c.id });
    if (!r.affected) throw new NotFoundException('Address not found');
    return { ok: true };
  }
}
