import { IsInt, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export const SHOP_KEY = 'shop';
export const PAYMENT_KEY = 'payment';

export interface ShopSettings {
  free_delivery_over_paise: number;
  delivery_fee_paise: number;
  gift_wrap_paise: number;
  free_samples_count: number;
  delivery_eta_text: string;
}
export const SHOP_DEFAULTS: ShopSettings = {
  free_delivery_over_paise: 200000, // free delivery from ₹2,000
  delivery_fee_paise: 9900,
  gift_wrap_paise: 15000,
  free_samples_count: 2,
  delivery_eta_text: '3–7 working days',
};

export interface PaymentSettings {
  upi_vpa: string;
  upi_payee_name: string;
}

const money = () => [IsInt(), Min(0), Max(10_000_000)];
const apply = (...d: PropertyDecorator[]): PropertyDecorator => (t, k) => d.forEach((x) => x(t, k));

export class ShopSettingsDto implements ShopSettings {
  @apply(...money()) free_delivery_over_paise: number;
  @apply(...money()) delivery_fee_paise: number;
  @apply(...money()) gift_wrap_paise: number;
  @IsInt() @Min(0) @Max(5) free_samples_count: number;
  @IsString() @MaxLength(80) delivery_eta_text: string;
}

// A UPI address: handle@bank. Anything else would make a QR that pays nobody (or somebody else).
const UPI_VPA = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}@[A-Za-z][A-Za-z0-9]{1,31}$/;

export class PaymentSettingsDto implements PaymentSettings {
  @Matches(UPI_VPA, { message: 'upi_vpa must look like name@bank' }) upi_vpa: string;
  @IsString() @MaxLength(40) @Matches(/^[A-Za-z0-9 &.'-]+$/, { message: 'payee name has unsupported characters' }) upi_payee_name: string;
}
