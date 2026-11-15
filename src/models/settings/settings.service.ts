import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { AppSetting } from './app-setting.entity';
import { PAYMENT_KEY, PaymentSettings, SHOP_DEFAULTS, SHOP_KEY, ShopSettings } from './settings.types';

// Every Indian state/UT, as accepted on delivery addresses. One list, served to the website.
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(AppSetting) private readonly repo: Repository<AppSetting>,
    private readonly config: ConfigService,
  ) {}

  private async read<T extends object>(key: string, defaults: T, m?: EntityManager): Promise<T> {
    const row = await (m ? m.getRepository(AppSetting) : this.repo).findOne({ where: { key } });
    return { ...defaults, ...(row?.value as Partial<T> | undefined) };
  }

  getShop(m?: EntityManager): Promise<ShopSettings> {
    return this.read(SHOP_KEY, SHOP_DEFAULTS, m);
  }

  /** The UPI address payments go to. Falls back to the environment until the owner sets one in the admin. */
  getPayment(m?: EntityManager): Promise<PaymentSettings> {
    return this.read(
      PAYMENT_KEY,
      { upi_vpa: this.config.get<string>('UPI_VPA', ''), upi_payee_name: this.config.get<string>('UPI_PAYEE_NAME', 'SmellMe') },
      m,
    );
  }

  async setShop(value: ShopSettings, adminId: string) {
    await this.repo.upsert({ key: SHOP_KEY, value: { ...value }, updated_by: adminId } as never, ['key']);
    return this.getShop();
  }

  async setPayment(value: PaymentSettings, adminId: string) {
    await this.repo.upsert({ key: PAYMENT_KEY, value: { ...value }, updated_by: adminId } as never, ['key']);
    return this.getPayment();
  }

  async publicSettings() {
    const s = await this.getShop();
    return { ...s, states: INDIAN_STATES };
  }
}
