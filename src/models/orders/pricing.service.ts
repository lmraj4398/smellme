import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { CouponsService } from '../coupons/coupons.service';
import { ProductVariant } from '../catalog/entities/product.entities';
import { SettingsService } from '../settings/settings.service';
import { MAX_LINE_QTY, type PriceCartDto } from './orders.dto';

export interface PricedLine {
  variant_id: string;
  product_id: string;
  product_slug: string;
  sku: string;
  name: string;
  brand: string;
  label: string;
  size_ml: number;
  unit_price_paise: number;
  qty: number;
  line_total_paise: number;
  is_free_sample: boolean;
  image_key: string | null;
  /** Set when this line cannot be bought as asked. It is then left out of the totals. */
  issue?: 'unavailable' | 'insufficient_stock';
  available?: number;
}

export interface Priced {
  lines: PricedLine[];
  issues: PricedLine[];
  subtotal_paise: number;
  discount_paise: number;
  coupon: { code: string; description: string } | null;
  coupon_id: string | null;
  coupon_error: string | null;
  delivery_fee_paise: number;
  gift_wrap_paise: number;
  total_paise: number;
  free_delivery_over_paise: number;
  free_samples_allowed: number;
}

/**
 * The ONLY place a price is decided. It trusts nothing from the browser except which size and how
 * many, re-reads everything from the database, and applies stock, delivery, wrap and coupon rules.
 */
@Injectable()
export class PricingService {
  constructor(private readonly settings: SettingsService, private readonly coupons: CouponsService) {}

  async price(m: EntityManager, input: PriceCartDto, customerId?: string): Promise<Priced> {
    const shop = await this.settings.getShop(m);

    // The same size listed twice is one line.
    const wanted = new Map<string, number>();
    for (const l of input.lines) wanted.set(l.variant_id, (wanted.get(l.variant_id) ?? 0) + l.qty);
    const freeIds = [...new Set(input.free_sample_ids ?? [])];
    if (freeIds.length > shop.free_samples_count) {
      throw new BadRequestException(shop.free_samples_count === 0 ? 'Free samples aren’t available right now' : `You can choose up to ${shop.free_samples_count} free samples`);
    }

    const ids = [...new Set([...wanted.keys(), ...freeIds])];
    const found = ids.length
      ? await m.createQueryBuilder(ProductVariant, 'v')
          .innerJoinAndSelect('v.product', 'p').innerJoinAndSelect('p.brand', 'b').innerJoinAndSelect('p.family', 'f').leftJoinAndSelect('p.media', 'media')
          .where('v.id IN (:...ids)', { ids }).getMany()
      : [];
    const byId = new Map(found.map((v) => [v.id, v]));
    const orderable = (v: ProductVariant) => v.is_active && v.product.is_active && v.product.brand.is_active && v.product.family.is_active;

    const toLine = (v: ProductVariant, qty: number, free: boolean): PricedLine => {
      const first = [...(v.product.media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      return {
        variant_id: v.id, product_id: v.product_id, product_slug: v.product.slug, sku: v.sku, name: v.product.name, brand: v.product.brand.name,
        label: v.label, size_ml: v.size_ml, unit_price_paise: free ? 0 : v.price_paise, qty, line_total_paise: free ? 0 : v.price_paise * qty,
        is_free_sample: free, image_key: first?.key ?? null,
      };
    };

    const lines: PricedLine[] = [];
    for (const [id, qty] of wanted) {
      const v = byId.get(id);
      if (!v || !orderable(v)) {
        lines.push({ ...ghost(id, qty), issue: 'unavailable' });
      } else if (qty > MAX_LINE_QTY) {
        throw new BadRequestException(`You can order up to ${MAX_LINE_QTY} of one item`);
      } else {
        const line = toLine(v, qty, false);
        lines.push(v.stock < qty ? { ...line, issue: 'insufficient_stock', available: Math.max(0, v.stock) } : line);
      }
    }
    for (const id of freeIds) {
      const v = byId.get(id);
      if (!v || !orderable(v)) throw new BadRequestException('One of the free samples is no longer available');
      if (!v.is_sample) throw new BadRequestException('Free samples must be sample vials');
      // The sample also has to cover anything of the same size the customer is paying for.
      const alsoBought = wanted.get(id) ?? 0;
      const line = toLine(v, 1, true);
      lines.push(v.stock < alsoBought + 1 ? { ...line, issue: 'insufficient_stock', available: Math.max(0, v.stock) } : line);
    }

    const good = lines.filter((l) => !l.issue);
    const subtotal = good.filter((l) => !l.is_free_sample).reduce((s, l) => s + l.line_total_paise, 0);

    let discount = 0;
    let coupon: Priced['coupon'] = null;
    let couponId: string | null = null;
    let couponError: string | null = null;
    if (input.coupon_code?.trim()) {
      const r = await this.coupons.evaluate(m, input.coupon_code, subtotal, customerId);
      if (r.ok) {
        discount = r.discount_paise;
        coupon = { code: r.coupon.code, description: r.coupon.description };
        couponId = r.coupon.id;
      } else {
        couponError = r.message;
      }
    }

    // Delivery is judged on what the customer is buying, before any coupon.
    const delivery = subtotal === 0 || subtotal >= shop.free_delivery_over_paise ? 0 : shop.delivery_fee_paise;
    const wrap = input.gift_wrap && subtotal > 0 ? shop.gift_wrap_paise : 0;

    return {
      lines, issues: lines.filter((l) => l.issue), subtotal_paise: subtotal, discount_paise: discount, coupon, coupon_id: couponId, coupon_error: couponError,
      delivery_fee_paise: delivery, gift_wrap_paise: wrap, total_paise: subtotal - discount + delivery + wrap,
      free_delivery_over_paise: shop.free_delivery_over_paise, free_samples_allowed: shop.free_samples_count,
    };
  }
}

const ghost = (id: string, qty: number): PricedLine => ({
  variant_id: id, product_id: '', product_slug: '', sku: '', name: 'Unavailable item', brand: '', label: '', size_ml: 0,
  unit_price_paise: 0, qty, line_total_paise: 0, is_free_sample: false, image_key: null,
});
