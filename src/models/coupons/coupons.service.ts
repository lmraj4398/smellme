import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { rethrowDbError } from '../../common/utils/db-error';
import { Coupon } from './coupon.entity';
import type { CouponDto } from './coupons.dto';

export type Evaluation = { ok: true; coupon: Coupon; discount_paise: number } | { ok: false; message: string };

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;
// Not-found, switched off, not started and expired all read the same: no hints about which codes exist.
const INVALID = { ok: false, message: 'This coupon isn’t valid' } as const;

/** Pure: the discount a coupon gives on a subtotal. Never more than the subtotal itself. */
function discountFor(c: Pick<Coupon, 'type' | 'value' | 'max_discount_paise'>, subtotal: number): number {
  const raw = c.type === 'percent' ? Math.floor((subtotal * c.value) / 100) : c.value;
  const capped = c.type === 'percent' && c.max_discount_paise ? Math.min(raw, c.max_discount_paise) : raw;
  return Math.max(0, Math.min(capped, subtotal));
}

@Injectable()
export class CouponsService {
  constructor(@InjectRepository(Coupon) private readonly repo: Repository<Coupon>) {}

  /** Can this code be used on this subtotal (items only, before delivery)? `customerId` adds the per-customer limit. */
  async evaluate(m: EntityManager | undefined, code: string, subtotal: number, customerId?: string): Promise<Evaluation> {
    const repo = m ? m.getRepository(Coupon) : this.repo;
    const c = await repo.findOne({ where: { code: code.trim().toUpperCase() } });
    const now = new Date();
    if (!c || !c.is_active || (c.starts_at && c.starts_at > now) || (c.ends_at && c.ends_at < now)) return INVALID;
    if (c.max_uses !== null && c.used_count >= c.max_uses) return { ok: false, message: 'This coupon has been fully used' };
    if (subtotal < c.min_order_paise) return { ok: false, message: `Add ${rupees(c.min_order_paise - subtotal)} more to use this coupon` };
    if (customerId && c.per_customer_limit > 0) {
      const used = await (m ?? this.repo.manager).query(
        `SELECT count(*)::int AS n FROM orders WHERE customer_id = $1 AND coupon_code = $2 AND status NOT IN ('CANCELLED','REFUNDED')`,
        [customerId, c.code],
      );
      if (used[0].n >= c.per_customer_limit) return { ok: false, message: 'You have already used this coupon' };
    }
    const discount_paise = discountFor(c, subtotal);
    if (discount_paise <= 0) return INVALID;
    return { ok: true, coupon: c, discount_paise };
  }

  /** Counts one use, atomically: two simultaneous orders cannot both take the last use. */
  async redeem(m: EntityManager, id: string): Promise<void> {
    const r = await m.query(
      `UPDATE coupons SET used_count = used_count + 1
       WHERE id = $1 AND is_active AND (max_uses IS NULL OR used_count < max_uses) RETURNING id`,
      [id],
    );
    const rows = Array.isArray(r[0]) ? r[0] : r;
    if (!rows.length) throw new ConflictException('This coupon has just been fully used');
  }

  /** Gives a use back (order cancelled before it was fulfilled). */
  async release(m: EntityManager, code: string): Promise<void> {
    await m.query('UPDATE coupons SET used_count = GREATEST(used_count - 1, 0) WHERE code = $1', [code]);
  }

  // ── admin ──
  list() {
    return this.repo.find({ order: { created_at: 'DESC' } });
  }

  async create(dto: CouponDto) {
    this.check(dto);
    try {
      return await this.repo.save(this.repo.create(this.fields(dto, true)));
    } catch (e) {
      rethrowDbError(e, 'A coupon with this code');
    }
  }

  async update(id: string, dto: CouponDto) {
    this.check(dto);
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Coupon not found');
    // The code never changes once created: orders refer to it.
    if (dto.code.trim().toUpperCase() !== row.code) throw new BadRequestException('A coupon’s code can’t be changed. Create a new coupon instead.');
    return this.repo.save(Object.assign(row, this.fields(dto, false)));
  }

  private check(d: CouponDto) {
    if (d.type === 'percent' && (d.value < 1 || d.value > 100)) throw new BadRequestException('A percentage must be between 1 and 100');
    if (d.type === 'flat' && d.value < 100) throw new BadRequestException('A flat discount must be at least ₹1');
    if (d.starts_at && d.ends_at && new Date(d.ends_at) <= new Date(d.starts_at)) throw new BadRequestException('The end date must be after the start date');
  }

  private fields(d: CouponDto, withCode: boolean): Partial<Coupon> {
    return {
      ...(withCode ? { code: d.code.trim().toUpperCase() } : {}),
      description: d.description ?? '', type: d.type, value: d.value, min_order_paise: d.min_order_paise ?? 0,
      max_discount_paise: d.type === 'percent' ? (d.max_discount_paise ?? null) : null,
      starts_at: d.starts_at ? new Date(d.starts_at) : null, ends_at: d.ends_at ? new Date(d.ends_at) : null,
      max_uses: d.max_uses ?? null, per_customer_limit: d.per_customer_limit ?? 1, is_active: d.is_active ?? true,
    };
  }
}
