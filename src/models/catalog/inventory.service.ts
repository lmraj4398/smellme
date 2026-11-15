import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdjustStockDto, InventoryQuery } from './dto/catalog.dto';
import { ProductVariant, StockLedger } from './entities/product.entities';
import { StockService } from './stock.service';

@Injectable()
export class InventoryService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(ProductVariant) private readonly variants: Repository<ProductVariant>,
    @InjectRepository(StockLedger) private readonly ledger: Repository<StockLedger>,
    private readonly stock: StockService,
  ) {}

  async list(q: InventoryQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 30;
    const qb = this.variants
      .createQueryBuilder('v')
      .innerJoin('v.product', 'p')
      .innerJoin('p.brand', 'b')
      .select([
        'v.id AS variant_id', 'v.sku AS sku', 'v.label AS label', 'v.size_ml AS size_ml', 'v.stock AS stock',
        'v.low_stock_at AS low_stock_at', 'v.is_active AS is_active', 'p.id AS product_id', 'p.name AS product_name',
        'p.is_active AS product_active', 'b.name AS brand',
      ]);
    if (q.q) {
      qb.andWhere('(p.name ILIKE :q OR v.sku ILIKE :q OR b.name ILIKE :q)', { q: `%${q.q.replace(/[\\%_]/g, '\\$&')}%` });
    }
    if (q.low) qb.andWhere('v.is_active = true AND v.stock <= v.low_stock_at');

    const total = await qb.clone().getCount();
    const items = await qb.orderBy('p.name', 'ASC').addOrderBy('v.size_ml', 'ASC').offset((page - 1) * limit).limit(limit).getRawMany();
    return { total, page, limit, items };
  }

  async adjust(variantId: string, dto: AdjustStockDto, adminId: string) {
    const stock = await this.ds.transaction((m) =>
      this.stock.change(m, { variantId, delta: dto.delta, reason: dto.reason, note: dto.note ?? null, adminId }),
    );
    return { variant_id: variantId, stock };
  }

  async history(variantId: string, page = 1, limit = 50) {
    if (!(await this.variants.exists({ where: { id: variantId } }))) throw new NotFoundException('Variant not found');
    const [items, total] = await this.ledger.findAndCount({
      where: { variant_id: variantId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { total, page, limit, items };
  }
}
