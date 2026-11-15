import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { INDIAN_STATES } from '../settings/settings.service';

export class SendOtpDto {
  @IsString() @MaxLength(20) phone: string;
}

export class VerifyOtpDto {
  @IsString() @MaxLength(20) phone: string;
  @IsString() @Matches(/^\d{6}$/, { message: 'code must be 6 digits' }) code: string;
  @IsOptional() @IsString() @MaxLength(120) name?: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail() @MaxLength(254) email?: string;
  // 'YYYY-MM-DD', or '' to remove it. Whether it is a real, past date is checked in the controller.
  @IsOptional() @Matches(/^(\d{4}-\d{2}-\d{2})?$/, { message: 'birthday must look like 1994-08-21' }) birthday?: string;
}

/** A delivery address. Used for saved addresses and for the snapshot stored on an order. */
export class AddressDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsString() @MaxLength(20) phone: string;
  @IsString() @IsNotEmpty() @MaxLength(200) line1: string;
  @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @IsString() @IsNotEmpty() @MaxLength(80) city: string;
  @IsIn(INDIAN_STATES as unknown as string[]) state: string;
  // Indian PIN codes are 6 digits and never start with 0.
  @Matches(/^[1-9]\d{5}$/, { message: 'pincode must be 6 digits' }) pincode: string;
}

export class SavedAddressDto extends AddressDto {
  @IsOptional() @IsString() @MaxLength(30) label?: string;
  @IsOptional() @IsBoolean() is_default?: boolean;
}
