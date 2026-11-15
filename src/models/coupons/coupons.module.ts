import { Body, Controller, Get, HttpCode, Module, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlainResponse } from '../../common/decorators/plain-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Screen } from '../../common/decorators/screen.decorator';
import { Coupon } from './coupon.entity';
import { CouponDto, ValidateCouponDto } from './coupons.dto';
import { CouponsService } from './coupons.service';

// Guessable short codes: the per-IP limiter on this path (rate-limits.ts) is what stops brute force.
@ApiTags('Coupons (public)')
@Public()
@PlainResponse()
@Controller('coupons')
class CouponsPublicController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('validate') @HttpCode(200)
  async validate(@Body() dto: ValidateCouponDto) {
    const r = await this.coupons.evaluate(undefined, dto.code, dto.subtotal_paise);
    return r.ok ? { valid: true, code: r.coupon.code, description: r.coupon.description, discount_paise: r.discount_paise } : { valid: false, message: r.message };
  }
}

@ApiTags('Coupons (admin)')
@ApiBearerAuth()
@Screen('coupons')
@Controller('admin/coupons')
class CouponsAdminController {
  constructor(private readonly coupons: CouponsService) {}

  @Get() list() { return this.coupons.list(); }
  @Post() create(@Body() dto: CouponDto) { return this.coupons.create(dto); }
  @Put(':id') update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: CouponDto) { return this.coupons.update(id, dto); }
}

@Module({
  imports: [TypeOrmModule.forFeature([Coupon])],
  controllers: [CouponsPublicController, CouponsAdminController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
