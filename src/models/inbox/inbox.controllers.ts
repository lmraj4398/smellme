import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlainResponse } from '../../common/decorators/plain-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Screen } from '../../common/decorators/screen.decorator';
import { ContactDto, InboxQuery, MarkReadDto, NewsletterDto } from './inbox.dto';
import { InboxService } from './inbox.service';

// Per-IP limits for these two live in common/security/rate-limits.ts.
@ApiTags('Contact & newsletter (public)')
@Public()
@PlainResponse()
@Controller()
export class InboxPublicController {
  constructor(private readonly inbox: InboxService) {}

  @Post('contact') @HttpCode(200) contact(@Body() dto: ContactDto) { return this.inbox.submitContact(dto); }
  @Post('newsletter') @HttpCode(200) newsletter(@Body() dto: NewsletterDto) { return this.inbox.subscribe(dto); }
}

@ApiTags('Inbox (admin)')
@ApiBearerAuth()
@Screen('marketing')
@Controller('admin/inbox')
export class InboxAdminController {
  constructor(private readonly inbox: InboxService) {}

  @Get('messages') messages(@Query() q: InboxQuery) { return this.inbox.listMessages(q); }
  @Patch('messages/:id') markRead(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: MarkReadDto) {
    return this.inbox.markRead(id, dto.is_read);
  }
  @Get('subscribers') subscribers(@Query() q: InboxQuery) { return this.inbox.listSubscribers(q); }
}
