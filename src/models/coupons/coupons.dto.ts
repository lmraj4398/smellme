import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class CouponDto {
  @Matches(/^[A-Za-z0-9_-]{3,30}$/, { message: 'code must be 3-30 letters, numbers, - or _' }) code: string;
  @IsOptional() @IsString() @MaxLength(120) description?: string;
  @IsIn(['percent', 'flat']) type: 'percent' | 'flat';
  @IsInt() @Min(1) @Max(10_000_000) value: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) min_order_paise?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10_000_000) max_discount_paise?: number | null;
  @IsOptional() @IsDateString() starts_at?: string | null;
  @IsOptional() @IsDateString() ends_at?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) max_uses?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(100) per_customer_limit?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class ValidateCouponDto {
  @IsString() @MaxLength(40) code: string;
  @IsInt() @Min(0) @Max(100_000_000) subtotal_paise: number;
}
