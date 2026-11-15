import { Body, Controller, Get, Header, HttpCode, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthedAdmin, CurrentAdmin } from '../../common/decorators/current-user.decorator';
import { OwnerOnly } from '../../common/decorators/owner-only.decorator';
import { PlainResponse } from '../../common/decorators/plain-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Screen } from '../../common/decorators/screen.decorator';
import { PaymentSettingsDto, ShopSettingsDto } from './settings.types';
import { SettingsService } from './settings.service';

@ApiTags('Settings (public)')
@Public()
@PlainResponse()
@Controller('settings')
export class SettingsPublicController {
  constructor(private readonly settings: SettingsService) {}

  // Delivery fee, free-delivery threshold, wrap price, states list. Never anything about payment.
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @Get('public')
  publicSettings() {
    return this.settings.publicSettings();
  }
}

@ApiTags('Settings (admin)')
@ApiBearerAuth()
@Controller('admin/settings')
export class SettingsAdminController {
  constructor(private readonly settings: SettingsService) {}

  @Screen('settings') @Get('shop') shop() { return this.settings.getShop(); }
  @Screen('settings') @Put('shop') @HttpCode(200)
  saveShop(@Body() dto: ShopSettingsDto, @CurrentAdmin() a: AuthedAdmin) { return this.settings.setShop(dto, a.id); }

  // Where customers' money goes. Owner only: a restricted login must never be able to repoint it.
  @OwnerOnly() @Get('payment') payment() { return this.settings.getPayment(); }
  @OwnerOnly() @Put('payment') @HttpCode(200)
  savePayment(@Body() dto: PaymentSettingsDto, @CurrentAdmin() a: AuthedAdmin) { return this.settings.setPayment(dto, a.id); }
}
