import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { StockLedger, StockReason } from './entities/product.entities';

export interface StockChange {
  variantId: string;
  /** Signed. Positive adds stock, negative removes it. */
  delta: number;
  reason: StockReason;
  note?: string | null;
  ref?: string | null;
  adminId?: string | null;
}

// The ONLY place stock changes. Callers pass their own transaction's manager so
// the stock movement commits or rolls back together with whatever caused it
// (an order, a product save...).
@Injectable()
export class StockService {
  async change(m: EntityManager, c: StockChange): Promise<number> {
    if (!Number.isInteger(c.delta) || c.delta === 0) throw new BadRequestException('Stock change must be a non-zero whole number');

    // One atomic statement: the row lock plus the >= 0 guard mean two concurrent
    // sales can never both take the last unit, and stock can never go negative.
    const res: unknown = await m.query(
      'UPDATE product_variants SET stock = stock + $1 WHERE id = $2 AND stock + $1 >= 0 RETURNING stock',
      [c.delta, c.variantId],
    );
    // node-postgres via TypeORM returns [rows, count] for UPDATE ... RETURNING.
    const rows = (Array.isArray((res as unknown[])[0]) ? (res as unknown[])[0] : res) as { stock: number }[];

    if (!rows.length) {
      const exists = await m.query('SELECT 1 FROM product_variants WHERE id = $1', [c.variantId]);
      if (!exists.length) throw new NotFoundException('Variant not found');
      throw new ConflictException('Not enough stock');
    }

    const balance = rows[0].stock;
    await m.insert(StockLedger, {
      variant_id: c.variantId,
      delta: c.delta,
      balance_after: balance,
      reason: c.reason,
      note: c.note ?? null,
      ref: c.ref ?? null,
      admin_id: c.adminId ?? null,
    });
    return balance;
  }
}
