import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength,
  ValidateIf,
} from 'class-validator';
import { SCREENS } from '../../../common/decorators/screen.decorator';
import { PASSWORD_MAX, PASSWORD_MESSAGE, PASSWORD_MIN, PASSWORD_RULE } from '../../../security/auth/password';

const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.toLowerCase() : value));
const Strong = () =>
  applyDecorators(
    MinLength(PASSWORD_MIN, { message: PASSWORD_MESSAGE }),
    MaxLength(PASSWORD_MAX, { message: PASSWORD_MESSAGE }),
    Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }),
  );

export class CreateLoginDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @lower() @IsEmail() @MaxLength(254) email: string;
  @IsString() @Strong() password: string;
  // null = unrestricted (another owner). Otherwise the screens this login may open.
  @ValidateIf((o) => o.screens !== null)
  @IsArray() @ArrayMaxSize(SCREENS.length) @ArrayUnique() @IsIn(SCREENS, { each: true })
  screens: string[] | null;
}

export class UpdateLoginDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120) name?: string;
  @IsOptional() @ValidateIf((o) => o.screens !== null)
  @IsArray() @ArrayMaxSize(SCREENS.length) @ArrayUnique() @IsIn(SCREENS, { each: true })
  screens?: string[] | null;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class ResetPasswordDto {
  @IsString() @Strong() new_password: string;
}
