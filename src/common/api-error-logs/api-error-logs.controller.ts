import { Controller, Delete, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Screen } from '../decorators/screen.decorator';
import { ClearGroupQuery, ErrorEntriesQuery, ErrorGroupsQuery } from './api-error-logs.dto';
import { ApiErrorLogsService } from './api-error-logs.service';

@ApiTags('Error logs (admin)')
@ApiBearerAuth()
@Screen('logs')
@Controller('admin/error-logs')
export class ApiErrorLogsController {
  constructor(private readonly logs: ApiErrorLogsService) {}

  @Get() groups(@Query() q: ErrorGroupsQuery) { return this.logs.groups(q); }
  @Get('entries') entries(@Query() q: ErrorEntriesQuery) { return this.logs.entries(q); }
  @Delete() clear(@Query() q: ClearGroupQuery) { return this.logs.clearGroup(q.group); }
}
