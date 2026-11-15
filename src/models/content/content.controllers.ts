import { Body, Controller, Delete, Get, Header, HttpCode, Param, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsObject } from 'class-validator';
import { AuthedAdmin, CurrentAdmin } from '../../common/decorators/current-user.decorator';
import { PlainResponse } from '../../common/decorators/plain-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Screen } from '../../common/decorators/screen.decorator';
import { ContentService } from './content.service';

class SaveSectionDto {
  @IsObject() data: Record<string, unknown>;
}

// Website copy is public by nature: unencrypted and cacheable.
@ApiTags('Content (public)')
@Public()
@PlainResponse()
@Controller('content')
export class ContentPublicController {
  constructor(private readonly content: ContentService) {}

  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300')
  @Get(':page')
  page(@Param('page') page: string) {
    return this.content.publicPage(page);
  }
}

@ApiTags('Content (admin)')
@ApiBearerAuth()
@Screen('content')
@Controller('admin/content')
export class ContentAdminController {
  constructor(private readonly content: ContentService) {}

  // Declared before ':page' so "schema" is not read as a page name.
  @Get('schema') schema() { return this.content.schema(); }
  @Get(':page') page(@Param('page') page: string) { return this.content.adminPage(page); }

  @Put(':page/:section') @HttpCode(200)
  save(@Param('page') page: string, @Param('section') section: string, @Body() dto: SaveSectionDto, @CurrentAdmin() a: AuthedAdmin) {
    return this.content.save(page, section, dto.data, a.id);
  }

  @Delete(':page/:section') @HttpCode(200)
  reset(@Param('page') page: string, @Param('section') section: string) {
    return this.content.reset(page, section);
  }
}
