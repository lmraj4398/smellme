import { Body, Controller, Get, Header, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { DataSource } from 'typeorm';
import { AuthedAdmin, CurrentAdmin } from '../../common/decorators/current-user.decorator';
import { PlainResponse } from '../../common/decorators/plain-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Screen } from '../../common/decorators/screen.decorator';
import { CurrentCustomer, CustomerRoute, type AuthedCustomer } from '../customers/customer.guard';
import { SettingsService } from '../settings/settings.service';
import {
  AdminOrdersQuery, ApproveDto, CreateOrderDto, DeliveryCheckQuery, PresignReceiptDto, PriceCartDto, ReasonDto, RefundDto, ShipDto, SubmitReceiptDto,
} from './orders.dto';
import { OrdersAdminService } from './orders-admin.service';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

const uuid = () => new ParseUUIDPipe({ version: '4' });

// ── Public: what the bag needs before anyone has signed in ──────────────────

@ApiTags('Cart (public)')
@Public()
@PlainResponse()
@Controller()
export class CartController {
  constructor(private readonly pricing: PricingService, @InjectDataSource() private readonly ds: DataSource, private readonly settings: SettingsService) {}

  // Re-prices a bag from the database. Plain (unencrypted) because it contains no personal data.
  @Post('cart/price') @HttpCode(200)
  async price(@Body() dto: PriceCartDto) {
    const p = await this.pricing.price(this.ds.manager, dto);
    return { ...p, coupon_id: undefined, lines: p.lines.map(({ product_id: _p, image_key, ...l }) => ({ ...l, image_key })) };
  }

  @Get('delivery/check')
  async delivery(@Query() q: DeliveryCheckQuery) {
    const s = await this.settings.getShop();
    return { pincode: q.pincode, serviceable: true, eta_text: s.delivery_eta_text };
  }
}

// ── Customer ────────────────────────────────────────────────────────────────

@ApiTags('Customer orders')
@ApiBearerAuth()
@CustomerRoute()
@Controller('customer/orders')
export class CustomerOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post() @HttpCode(201)
  create(@CurrentCustomer() c: AuthedCustomer, @Body() dto: CreateOrderDto) { return this.orders.create(c.id, dto); }

  @Get() list(@CurrentCustomer() c: AuthedCustomer, @Query('page') page?: string) { return this.orders.listMine(c.id, Math.max(1, Number(page) || 1)); }
  @Get(':orderNo') get(@CurrentCustomer() c: AuthedCustomer, @Param('orderNo') no: string) { return this.orders.getMine(c.id, no); }

  @Post(':orderNo/receipt/presign') @HttpCode(200)
  presign(@CurrentCustomer() c: AuthedCustomer, @Param('orderNo') no: string, @Body() dto: PresignReceiptDto) { return this.orders.presignReceipt(c.id, no, dto); }

  @Post(':orderNo/receipt') @HttpCode(200)
  receipt(@CurrentCustomer() c: AuthedCustomer, @Param('orderNo') no: string, @Body() dto: SubmitReceiptDto) { return this.orders.submitReceipt(c.id, no, dto); }

  @Post(':orderNo/cancel') @HttpCode(200)
  cancel(@CurrentCustomer() c: AuthedCustomer, @Param('orderNo') no: string) { return this.orders.cancelMine(c.id, no); }
}

// ── Admin ───────────────────────────────────────────────────────────────────

class CustomersQuery {
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
}

@ApiTags('Orders (admin)')
@ApiBearerAuth()
@Screen('orders')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly admin: OrdersAdminService) {}

  @Get() list(@Query() q: AdminOrdersQuery) { return this.admin.list(q); }
  @Get('summary') summary() { return this.admin.summary(); }
  @Get(':id') detail(@Param('id', uuid()) id: string) { return this.admin.detail(id); }
  @Header('Cache-Control', 'no-store')
  @Get(':id/receipt-url') receipt(@Param('id', uuid()) id: string) { return this.admin.receiptUrl(id); }

  @Post(':id/approve-payment') @HttpCode(200)
  approve(@Param('id', uuid()) id: string, @Body() dto: ApproveDto, @CurrentAdmin() a: AuthedAdmin) { return this.admin.approve(id, dto, a.id); }
  @Post(':id/reject-payment') @HttpCode(200)
  reject(@Param('id', uuid()) id: string, @Body() dto: ReasonDto, @CurrentAdmin() a: AuthedAdmin) { return this.admin.reject(id, dto.reason, a.id); }
  @Post(':id/pack') @HttpCode(200)
  pack(@Param('id', uuid()) id: string, @CurrentAdmin() a: AuthedAdmin) { return this.admin.pack(id, a.id); }
  @Post(':id/ship') @HttpCode(200)
  ship(@Param('id', uuid()) id: string, @Body() dto: ShipDto, @CurrentAdmin() a: AuthedAdmin) { return this.admin.ship(id, dto, a.id); }
  @Post(':id/deliver') @HttpCode(200)
  deliver(@Param('id', uuid()) id: string, @CurrentAdmin() a: AuthedAdmin) { return this.admin.deliver(id, a.id); }
  @Post(':id/cancel') @HttpCode(200)
  cancel(@Param('id', uuid()) id: string, @Body() dto: ReasonDto, @CurrentAdmin() a: AuthedAdmin) { return this.admin.cancel(id, dto.reason, a.id); }
  @Post(':id/refund') @HttpCode(200)
  refund(@Param('id', uuid()) id: string, @Body() dto: RefundDto, @CurrentAdmin() a: AuthedAdmin) { return this.admin.refund(id, dto.note, a.id); }
}

@ApiTags('Customers (admin)')
@ApiBearerAuth()
@Screen('customers')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  async list(@Query() q: CustomersQuery) {
    const page = q.page ?? 1;
    const limit = 30;
    const term = q.q?.trim();
    const where = term ? 'WHERE c.phone LIKE $1 OR c.name ILIKE $2 OR c.email ILIKE $2' : '';
    const params = term ? [`%${term.replace(/\D/g, '') || '@@'}%`, `%${term.replace(/[\\%_]/g, '\\$&')}%`] : [];
    const total = (await this.ds.query(`SELECT count(*)::int AS n FROM customers c ${where}`, params))[0].n;
    const items = await this.ds.query(
      `SELECT c.id, c.name, c.phone, c.email, to_char(c.birthday, 'YYYY-MM-DD') AS birthday, c.created_at, c.last_login_at,
              count(o.id) FILTER (WHERE o.status NOT IN ('CANCELLED','REFUNDED'))::int AS orders_count,
              COALESCE(sum(o.total_paise) FILTER (WHERE o.status IN ('PAID','PACKED','SHIPPED','DELIVERED')), 0)::bigint AS total_spent_paise
       FROM customers c LEFT JOIN orders o ON o.customer_id = c.id ${where}
       GROUP BY c.id ORDER BY c.created_at DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params,
    );
    return { total, page, limit, items: items.map((i: { total_spent_paise: string }) => ({ ...i, total_spent_paise: Number(i.total_spent_paise) })) };
  }
}
