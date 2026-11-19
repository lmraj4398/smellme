import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { rethrowDbError } from '../../common/utils/db-error';
import { slugify } from '../../common/utils/slug';
import { R2Service } from '../../common/r2/r2.service';
import { AdminProductsQuery, ProductDto, VariantDto } from './dto/catalog.dto';
import { Product, ProductMedia, ProductNote, ProductVariant } from './entities/product.entities';
import { Brand, Note, ScentFamily } from './entities/taxonomy.entities';
import { StockService } from './stock.service';

const PRODUCT_COLUMNS = [
  'name', 'brand_id', 'family_id', 'descriptors', 'concentration', 'gender', 'short_description', 'story',
  'how_to_wear', 'ingredients', 'badge', 'tint', 'liquid', 'mono', 'longevity_label', 'longevity_level',
  'projection_label', 'projection_level', 'season_label', 'season_level', 'occasion_label', 'occasion_level',
  'is_active', 'is_featured', 'sort_order',
] as const;

@Injectable()
export class ProductsAdminService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly stock: StockService,
    private readonly r2: R2Service,
  ) {}

  async list(q: AdminProductsQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('p.family', 'f')
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (q.q) qb.andWhere('(p.name ILIKE :q OR b.name ILIKE :q)', { q: `%${q.q.replace(/[%_]/g, '\\$&')}%` });
    if (q.active !== undefined) qb.andWhere('p.is_active = :a', { a: q.active });
    if (q.brand_id) qb.andWhere('p.brand_id = :b', { b: q.brand_id });
    if (q.family_id) qb.andWhere('p.family_id = :f', { f: q.family_id });

    const [rows, total] = await qb.getManyAndCount();
    const variants = rows.length
      ? await this.ds.getRepository(ProductVariant).find({ where: { product_id: In(rows.map((r) => r.id)) } })
      : [];
    return {
      total,
      page,
      limit,
      items: rows.map((p) => {
        const vs = variants.filter((v) => v.product_id === p.id);
        const active = vs.filter((v) => v.is_active);
        return {
          id: p.id, slug: p.slug, name: p.name, brand: p.brand.name, family: p.family.name, is_active: p.is_active,
          is_featured: p.is_featured, badge: p.badge, tint: p.tint, liquid: p.liquid, mono: p.mono,
          variant_count: active.length,
          min_price_paise: active.length ? Math.min(...active.map((v) => v.price_paise)) : null,
          total_stock: active.reduce((s, v) => s + v.stock, 0),
        };
      }),
    };
  }

  async get(id: string) {
    const p = await this.products.findOne({
      where: { id },
      relations: { variants: true, notes: { note: true }, media: true },
    });
    if (!p) throw new NotFoundException('Product not found');
    return {
      ...p,
      variants: [...p.variants].sort((a, b) => a.sort_order - b.sort_order || a.size_ml - b.size_ml),
      notes: [...p.notes].sort((a, b) => a.sort_order - b.sort_order),
      media: [...p.media].sort((a, b) => a.sort_order - b.sort_order).map((m) => ({ ...m, url: this.r2.publicUrl(m.key) })),
    };
  }

  async create(dto: ProductDto, adminId: string) {
    try {
      const id = await this.ds.transaction(async (m) => {
        await this.assertRefs(m, dto);
        const slug = await this.uniqueSlug(m, dto.slug ?? slugify(dto.name));
        const product = await m.save(Product, m.create(Product, { ...this.columns(dto), slug }));
        await this.writeChildren(m, product, dto, adminId, true);
        return product.id;
      });
      return await this.get(id);
    } catch (e) {
      rethrowDbError(e, 'A product or SKU with this name');
    }
  }

  async update(id: string, dto: ProductDto, adminId: string) {
    try {
      const dropped = await this.ds.transaction(async (m) => {
        const product = await m.findOne(Product, { where: { id } });
        if (!product) throw new NotFoundException('Product not found');
        await this.assertRefs(m, dto);
        Object.assign(product, this.columns(dto));
        if (dto.slug && dto.slug !== product.slug) product.slug = await this.uniqueSlug(m, dto.slug, product.id);
        await m.save(Product, product);
        return this.writeChildren(m, product, dto, adminId, false);
      });
      // After commit, best-effort: a failed R2 delete must never fail a saved product.
      await Promise.allSettled(dropped.map((k) => this.r2.delete('media', k)));
      return await this.get(id);
    } catch (e) {
      rethrowDbError(e, 'A product or SKU with this name');
    }
  }

  async setActive(id: string, active: boolean) {
    const r = await this.products.update(id, { is_active: active });
    if (!r.affected) throw new NotFoundException('Product not found');
    return { id, is_active: active };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private columns(dto: ProductDto) {
    const out: Record<string, unknown> = {};
    for (const k of PRODUCT_COLUMNS) if ((dto as unknown as Record<string, unknown>)[k] !== undefined) out[k] = (dto as unknown as Record<string, unknown>)[k];
    return out;
  }

  private async assertRefs(m: EntityManager, dto: ProductDto) {
    if (!(await m.exists(Brand, { where: { id: dto.brand_id } }))) throw new BadRequestException('Unknown brand');
    if (!(await m.exists(ScentFamily, { where: { id: dto.family_id } }))) throw new BadRequestException('Unknown scent family');
    const noteIds = [...new Set(dto.notes.map((n) => n.note_id))];
    if (noteIds.length && (await m.count(Note, { where: { id: In(noteIds) } })) !== noteIds.length) {
      throw new BadRequestException('Unknown note');
    }
    const keys = dto.media.map((x) => x.key);
    if (new Set(keys).size !== keys.length) throw new BadRequestException('Duplicate image');
    const pairs = dto.notes.map((n) => `${n.note_id}:${n.tier}`);
    if (new Set(pairs).size !== pairs.length) throw new BadRequestException('Duplicate note in the same tier');
    const skus = dto.variants.map((v) => v.sku).filter(Boolean);
    if (new Set(skus).size !== skus.length) throw new BadRequestException('Duplicate SKU');
    if (dto.is_active !== false && !dto.variants.some((v) => v.is_active !== false)) {
      throw new BadRequestException('An active product needs at least one active size');
    }
  }

  private async uniqueSlug(m: EntityManager, base: string, exceptId?: string): Promise<string> {
    const root = base || 'product';
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      const hit = await m.findOne(Product, { where: { slug: candidate }, select: { id: true } });
      if (!hit || hit.id === exceptId) return candidate;
    }
    throw new BadRequestException('Could not derive a unique slug; set one explicitly');
  }

  /** Returns the media keys that were removed, for cleanup after commit. */
  private async writeChildren(m: EntityManager, product: Product, dto: ProductDto, adminId: string, isNew: boolean): Promise<string[]> {
    // Variants: update the ones sent (they must belong to THIS product), add new ones, and
    // retire - never delete - the ones left out, because orders will reference them.
    const existing = isNew ? [] : await m.find(ProductVariant, { where: { product_id: product.id } });
    const byId = new Map(existing.map((v) => [v.id, v]));
    const keep = new Set<string>();

    for (const [i, v] of dto.variants.entries()) {
      if (v.id) {
        const row = byId.get(v.id);
        if (!row) throw new BadRequestException('Size does not belong to this product');
        keep.add(row.id);
        Object.assign(row, this.variantColumns(v, i));
        if (v.sku) row.sku = v.sku;
        await m.save(ProductVariant, row);
      } else {
        const sku = v.sku ?? (await this.freeSku(m, `${product.slug}-${v.size_ml}ml`));
        const row = await m.save(ProductVariant, m.create(ProductVariant, { product_id: product.id, sku, stock: 0, ...this.variantColumns(v, i) }));
        keep.add(row.id);
        if (v.stock) {
          await this.stock.change(m, { variantId: row.id, delta: v.stock, reason: 'opening', adminId });
        }
      }
    }
    for (const row of existing) {
      if (!keep.has(row.id) && row.is_active) await m.update(ProductVariant, row.id, { is_active: false });
    }

    // Notes and media are plain lists with no external references: replace wholesale.
    await m.delete(ProductNote, { product_id: product.id });
    if (dto.notes.length) {
      await m.insert(ProductNote, dto.notes.map((n, i) => ({ product_id: product.id, note_id: n.note_id, tier: n.tier, sort_order: i })));
    }
    const oldKeys = isNew ? [] : (await m.find(ProductMedia, { where: { product_id: product.id } })).map((x) => x.key);
    await m.delete(ProductMedia, { product_id: product.id });
    if (dto.media.length) {
      await m.insert(ProductMedia, dto.media.map((x, i) => ({ product_id: product.id, key: x.key, alt: x.alt ?? '', sort_order: i })));
    }
    return oldKeys.filter((k) => !dto.media.some((x) => x.key === k));
  }

  private variantColumns(v: VariantDto, i: number) {
    return {
      label: v.label,
      size_ml: v.size_ml,
      price_paise: v.price_paise,
      mrp_paise: v.mrp_paise ?? null,
      is_sample: v.is_sample ?? false,
      low_stock_at: v.low_stock_at ?? 5,
      is_active: v.is_active ?? true,
      sort_order: v.sort_order ?? i,
    };
  }

  private async freeSku(m: EntityManager, base: string): Promise<string> {
    const root = base.slice(0, 36);
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? root : `${root}-${i + 1}`;
      if (!(await m.exists(ProductVariant, { where: { sku: candidate } }))) return candidate;
    }
    throw new BadRequestException('Could not derive a unique SKU');
  }
}
