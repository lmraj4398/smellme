import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDefined, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AddressDto } from '../customers/customer.dto';
import { ORDER_STATUSES } from './order-state';

export const MAX_LINE_QTY = 9;

export class CartLineDto {
  @IsUUID() variant_id: string;
  @IsInt() @Min(1) @Max(MAX_LINE_QTY) qty: number;
}

/** What the bag sends. Only ids and quantities: prices are never accepted from the client. */
export class PriceCartDto {
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CartLineDto) lines: CartLineDto[];
  @IsOptional() @IsString() @MaxLength(40) coupon_code?: string;
  @IsOptional() @IsBoolean() gift_wrap?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(5) @IsUUID('all', { each: true }) free_sample_ids?: string[];
}

export class CreateOrderDto extends PriceCartDto {
  @IsUUID() client_ref: string;
  // IsDefined matters: @ValidateNested alone passes when the field is missing entirely.
  @IsDefined() @ValidateNested() @Type(() => AddressDto) address: AddressDto;
  @IsOptional() @IsString() @MaxLength(250) gift_message?: string;
  // Up to 14 characters, a small safe set: it is engraved on a bottle.
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9 .'&-]{0,14}$/, { message: 'engraving can have up to 14 letters, numbers or . \' & -' }) engraving?: string;
}

export class PresignReceiptDto {
  @IsString() @MaxLength(40) content_type: string;
  @IsInt() @Min(1) @Max(50 * 1024 * 1024) size: number;
}

export class SubmitReceiptDto {
  @IsString() @MaxLength(200) key: string;
  // The 12-character UPI reference printed on the payment screen.
  @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/^[A-Za-z0-9]{6,30}$/, { message: 'the UTR / reference must be 6-30 letters or numbers' }) utr?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100_000_000) paid_amount_paise?: number;
}

export class ReasonDto {
  @IsString() @IsNotEmpty() @MaxLength(300) reason: string;
}

export class ApproveDto {
  // Staff must tick these knowingly when the receipt doesn't match what was expected.
  @IsOptional() @IsBoolean() confirm_amount_mismatch?: boolean;
  @IsOptional() @IsBoolean() confirm_duplicate_utr?: boolean;
}

export class ShipDto {
  @IsString() @IsNotEmpty() @MaxLength(60) carrier: string;
  @IsString() @IsNotEmpty() @MaxLength(80) tracking_no: string;
}

export class RefundDto {
  @IsString() @IsNotEmpty() @MaxLength(300) note: string;
}

export class DeliveryCheckQuery {
  @Matches(/^[1-9]\d{5}$/, { message: 'pincode must be 6 digits' }) pincode: string;
}

export class AdminOrdersQuery {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() @MaxLength(60) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
}

export const isStatus = (s: string | undefined): s is (typeof ORDER_STATUSES)[number] => !!s && (ORDER_STATUSES as readonly string[]).includes(s);
