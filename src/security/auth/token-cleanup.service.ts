import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthService } from './auth.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly auth: AuthService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async run() {
    try {
      const n = await this.auth.purgeExpired();
      if (n) this.logger.log(`Purged ${n} expired refresh tokens`);
    } catch (err) {
      this.logger.warn(`Token cleanup failed: ${(err as Error).message}`);
    }
  }
}
