import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthedAdmin, CurrentAdmin } from '../../common/decorators/current-user.decorator';
import { OwnerOnly } from '../../common/decorators/owner-only.decorator';
import { SCREENS } from '../../common/decorators/screen.decorator';
import { AdminUsersService } from './admin-users.service';
import { CreateLoginDto, ResetPasswordDto, UpdateLoginDto } from './dto/admin-users.dto';

// Only an unrestricted login (the owner) may manage logins and their screen limits.
@ApiTags('Logins')
@ApiBearerAuth()
@OwnerOnly()
@Controller('admin/logins')
export class AdminUsersController {
  constructor(private readonly logins: AdminUsersService) {}

  @Get() async list() {
    return { screens: SCREENS, items: await this.logins.list() };
  }
  @Post() create(@Body() dto: CreateLoginDto) { return this.logins.create(dto); }
  @Patch(':id') update(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: UpdateLoginDto, @CurrentAdmin() a: AuthedAdmin) {
    return this.logins.update(id, dto, a.id);
  }
  @Post(':id/reset-password') @HttpCode(200)
  reset(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() dto: ResetPasswordDto, @CurrentAdmin() a: AuthedAdmin) {
    return this.logins.resetPassword(id, dto.new_password, a.id);
  }
}
