import { Controller, Get, Global, Module, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Repository } from 'typeorm';
import { Screen } from '../../common/decorators/screen.decorator';
import { isProductionEnv } from '../../common/utils/env.util';
import { WHATSAPP_EVENTS, WhatsAppMessage } from './whatsapp-message.entity';
import { ConsoleProvider, GupshupProvider, UnconfiguredProvider, WHATSAPP_PROVIDER, type WhatsAppProvider } from './whatsapp.provider';
import { WhatsAppService } from './whatsapp.service';

class LogQuery {
  @IsOptional() @IsIn(['sent', 'failed', 'skipped']) status?: 'sent' | 'failed' | 'skipped';
  @IsOptional() @IsIn(WHATSAPP_EVENTS) event?: (typeof WHATSAPP_EVENTS)[number];
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
}

@ApiTags('WhatsApp log')
@ApiBearerAuth()
@Screen('logs')
@Controller('admin/whatsapp')
class WhatsAppAdminController {
  constructor(@InjectRepository(WhatsAppMessage) private readonly log: Repository<WhatsAppMessage>) {}

  @Get('messages')
  async list(@Query() q: LogQuery) {
    const page = q.page ?? 1;
    const limit = 50;
    const [items, total] = await this.log.findAndCount({
      where: { ...(q.status ? { status: q.status } : {}), ...(q.event ? { event: q.event } : {}) },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { total, page, limit, items };
  }
}

function chooseProvider(config: ConfigService): WhatsAppProvider {
  const configured = !!(config.get('GUPSHUP_API_KEY') && config.get('GUPSHUP_SOURCE_NUMBER'));
  if (configured) return new GupshupProvider(config);
  // Never print messages (and so OTPs) to the console of a production server.
  return isProductionEnv(process.env.NODE_ENV) ? new UnconfiguredProvider() : new ConsoleProvider();
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([WhatsAppMessage])],
  controllers: [WhatsAppAdminController],
  providers: [{ provide: WHATSAPP_PROVIDER, inject: [ConfigService], useFactory: chooseProvider }, WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
