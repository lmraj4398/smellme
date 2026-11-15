import { Module } from '@nestjs/common';
import { Cron, CronExpression, ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Injectable } from '@nestjs/common';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerAccountController, CustomerAuthController } from './customer.controllers';
import { Customer, CustomerAddress, CustomerOtp, CustomerRefreshToken } from './customer.entities';
import { CustomerAuthGuard } from './customer.guard';

@Injectable()
class CustomerCleanup {
  constructor(private readonly auth: CustomerAuthService) {}
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  run() {
    return this.auth.purgeExpired().catch(() => undefined);
  }
}

@Module({
  imports: [TypeOrmModule.forFeature([Customer, CustomerAddress, CustomerOtp, CustomerRefreshToken]), ScheduleModule],
  controllers: [CustomerAuthController, CustomerAccountController],
  providers: [CustomerAuthService, CustomerAuthGuard, CustomerCleanup],
  exports: [TypeOrmModule],
})
export class CustomersModule {}
