import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiErrorLog } from './api-error-log.entity';
import { ApiErrorLogsController } from './api-error-logs.controller';
import { ApiErrorLogsService } from './api-error-logs.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiErrorLog])],
  controllers: [ApiErrorLogsController],
  providers: [ApiErrorLogsService],
  exports: [ApiErrorLogsService],
})
export class ApiErrorLogsModule {}
