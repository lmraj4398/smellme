import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { R2Service } from '../../common/r2/r2.service';
import { PublicProductsQuery } from './dto/catalog.dto';
import { Concentration, Product, ProductVariant } from './entities/product.entities';

const CONCENTRATION_LABEL: Record<Concentration, string> = {
  extrait: 'Extrait de Parfum',
  edp: 'Eau de Parfum',
  edt: 'Eau de Toilette',
  attar: 'Attar',
  mist: 'Body mist',
};

// The size a card (and the product page's preselected size) represents: the FIRST full-size
// bottle in the product's own size order, falling back to the first size of any kind for a
// product sold only as samples. The admin controls it simply by ordering the sizes - so the
// flagship 50 ml shows, not a 10 ml travel spray that happens to be cheaper.
const DEFAULT_VARIANT = (col: string) => `COALESCE(
  (SELECT v.${col} FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND NOT v.is_sample ORDER BY v.sort_order, v.size_ml LIMIT 1),
  (SELECT v.${col} FROM product_variants v WHERE v.product_id = p.id AND v.is_active ORDER BY v.sort_order, v.size_ml LIMIT 1))`;
const CARD_PRICE = DEFAULT_VARIANT('price_paise');
const HAS_ACTIVE_VARIANT = `EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active)`;

type Loaded = Product & { variants: ProductVariant[] };

@Injectable()
export class ProductsPublicService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    private readonly r2: R2Service,
  ) {}

  // Only what a shopper may see: active product, brand and family, with something to buy.
  private visible(): SelectQueryBuilder<Product> {
    return this.products
      .createQueryBuilder('p')
      .innerJoin('p.brand', 'b')
      .innerJoin('p.family', 'f')
      .where('p.is_active = true AND b.is_active = true AND f.is_active = true')
      .andWhere(HAS_ACTIVE_VARIANT);
  }

  async list(q: PublicProductsQuery) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;
    const qb = this.visible();

    if (q.q) {
      qb.andWhere('(p.name ILIKE :q OR b.name ILIKE :q OR f.name ILIKE :q OR p.descriptors ILIKE :q)', {
        q: `%${q.q.replace(/[\\%_]/g, '\\$&')}%`,
      });
    }
    if (q.family?.length) qb.andWhere('f.slug IN (:...fam)', { fam: q.family });
    if (q.brand?.length) qb.andWhere('b.slug IN (:...brand)', { brand: q.brand });
    if (q.gender?.length) qb.andWhere('p.gender IN (:...gender)', { gender: q.gender });
    if (q.concentration?.length) qb.andWhere('p.concentration IN (:...conc)', { conc: q.concentration });
    if (q.price_min !== undefined) qb.andWhere(`${CARD_PRICE} >= :pmin`, { pmin: q.price_min });
    if (q.price_max !== undefined) qb.andWhere(`${CARD_PRICE} <= :pmax`, { pmax: q.price_max });
    if (q.sample) qb.andWhere('EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id AND v.is_active AND v.is_sample)');

    const total = await qb.clone().getCount();

    // Two steps: page the ids with the ordering expressions, then load the rows.
    // (Ordering by a computed price and eager-loading children don't mix in one TypeORM query.)
    const idQb = qb.clone().select('p.id', 'id').addSelect(CARD_PRICE, 'card_price');
    switch (q.sort ?? 'pop') {
      case 'new':
        idQb.orderBy('p.created_at', 'DESC');
        break;
      case 'low':
        idQb.orderBy('card_price', 'ASC').addOrderBy('p.created_at', 'DESC');
        break;
      case 'high':
        idQb.orderBy('card_price', 'DESC').addOrderBy('p.created_at', 'DESC');
        break;
      default:
        idQb.orderBy('p.is_featured', 'DESC').addOrderBy('p.sort_order', 'ASC').addOrderBy('p.created_at', 'DESC');
    }
    const ids = (await idQb.offset((page - 1) * limit).limit(limit).getRawMany<{ id: string }>()).map((r) => r.id);

    return { total, page, limit, items: await this.cardsFor(ids) };
  }

  async get(slug: string) {
    const p = await this.visible()
      .andWhere('p.slug = :slug', { slug })
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.family', 'family')
      .leftJoinAndSelect('p.variants', 'variant', 'variant.is_active = true')
      .leftJoinAndSelect('p.notes', 'pn')
      .leftJoinAndSelect('pn.note', 'note')
      .leftJoinAndSelect('p.media', 'media')
      .getOne();
    if (!p) throw new NotFoundException('Product not found');

    const variants = [...p.variants].sort((a, b) => a.sort_order - b.sort_order || a.size_ml - b.size_ml);
    const defaultId = (variants.find((v) => !v.is_sample) ?? variants[0])?.id;
    const tiers = (['top', 'heart', 'base'] as const)
      .map((tier) => ({
        tier,
        items: p.notes
          .filter((n) => n.tier === tier)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((n) => ({ name: n.note.name, color: n.note.color })),
      }))
      .filter((t) => t.items.length);
    const meters = [
      { key: 'longevity', label: p.longevity_label, level: p.longevity_level },
      { key: 'projection', label: p.projection_label, level: p.projection_level },
      { key: 'season', label: p.season_label, level: p.season_level },
      { key: 'occasion', label: p.occasion_label, level: p.occasion_level },
    ].filter((m) => m.label);

    const related = await this.related(p);
    return {
      ...this.card(p as Loaded),
      short_description: p.short_description,
      story: p.story,
      how_to_wear: p.how_to_wear,
      ingredients: p.ingredients,
      variants: variants.map((v) => ({
        id: v.id, sku: v.sku, label: v.label, size_ml: v.size_ml, price_paise: v.price_paise,
        mrp_paise: v.mrp_paise, is_sample: v.is_sample, is_default: v.id === defaultId, in_stock: v.stock > 0, low_stock: v.stock > 0 && v.stock <= v.low_stock_at,
      })),
      notes: tiers,
      meters,
      media: [...p.media].sort((a, b) => a.sort_order - b.sort_order).map((m) => ({ url: this.r2.publicUrl(m.key), alt: m.alt })),
      related,
    };
  }

  async filters() {
    const base = () => this.visible().select([]);
    const [families, brands, genders, concentrations, price] = await Promise.all([
      base().innerJoin('p.family', 'ff').select('ff.slug', 'slug').addSelect('ff.name', 'name').addSelect('ff.tint', 'tint')
        .addSelect('ff.sort_order', 'so').addSelect('COUNT(*)::int', 'count').groupBy('ff.id').orderBy('ff.sort_order').addOrderBy('ff.name').getRawMany(),
      base().innerJoin('p.brand', 'bb').select('bb.slug', 'slug').addSelect('bb.name', 'name').addSelect('bb.is_original', 'is_original')
        .addSelect('COUNT(*)::int', 'count').groupBy('bb.id').orderBy('bb.sort_order').addOrderBy('bb.name').getRawMany(),
      base().select('p.gender', 'value').addSelect('COUNT(*)::int', 'count').groupBy('p.gender').getRawMany(),
      base().select('p.concentration', 'value').addSelect('COUNT(*)::int', 'count').groupBy('p.concentration').getRawMany(),
      base().select(`MIN(${CARD_PRICE})`, 'min').addSelect(`MAX(${CARD_PRICE})`, 'max').getRawOne<{ min: number | null; max: number | null }>(),
    ]);
    return {
      families: families.map(({ slug, name, tint, count }) => ({ slug, name, tint, count })),
      brands: brands.map(({ slug, name, is_original, count }) => ({ slug, name, is_original, count })),
      genders,
      concentrations: concentrations.map((c: { value: Concentration; count: number }) => ({ ...c, label: CONCENTRATION_LABEL[c.value] })),
      price_paise: { min: price?.min ?? 0, max: price?.max ?? 0 },
    };
  }

  /** Sample vials a customer can pick as their free samples: in stock, on sale, from visible products. */
  async samples() {
    const rows = await this.products
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.brand', 'b')
      .innerJoin('p.family', 'f')
      .innerJoinAndSelect('p.variants', 'v', 'v.is_active = true AND v.is_sample = true AND v.stock > 0')
      .where('p.is_active = true AND b.is_active = true AND f.is_active = true')
      .orderBy('p.is_featured', 'DESC').addOrderBy('p.sort_order', 'ASC').addOrderBy('p.name', 'ASC')
      .limit(60)
      .getMany();
    return rows.flatMap((p) => p.variants.map((v) => ({
      variant_id: v.id, product_name: p.name, brand: p.brand.name, label: v.label, tint: p.tint, liquid: p.liquid, mono: p.mono,
    })));
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async related(p: Product) {
    const rows = await this.visible()
      .select('p.id', 'id')
      .andWhere('p.family_id = :fid AND p.id <> :id', { fid: p.family_id, id: p.id })
      .orderBy('p.is_featured', 'DESC')
      .addOrderBy('p.sort_order', 'ASC')
      .limit(4)
      .getRawMany<{ id: string }>();
    return this.cardsFor(rows.map((r) => r.id));
  }

  /** Is this a product a shopper may see (active, with an active brand, family and size)? */
  async isVisible(id: string) {
    return (await this.visible().andWhere('p.id = :id', { id }).getCount()) > 0;
  }

  /** Cards for the given ids, in the same order, leaving out anything a shopper may not see. */
  async visibleCards(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.visible().select('p.id', 'id').andWhere('p.id IN (:...ids)', { ids }).getRawMany<{ id: string }>();
    const ok = new Set(rows.map((r) => r.id));
    return this.cardsFor(ids.filter((id) => ok.has(id)));
  }

  private async cardsFor(ids: string[]) {
    if (!ids.length) return [];
    const rows = await this.products
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.brand', 'brand')
      .leftJoinAndSelect('p.family', 'family')
      .leftJoinAndSelect('p.variants', 'variant', 'variant.is_active = true')
      .leftJoinAndSelect('p.media', 'media')
      .whereInIds(ids)
      .getMany();
    const order = new Map(ids.map((id, i) => [id, i]));
    return rows.sort((a, b) => order.get(a.id)! - order.get(b.id)!).map((p) => this.card(p as Loaded));
  }

  card(p: Loaded) {
    const vs = p.variants.filter((v) => v.is_active);
    const byOrder = [...vs].sort((a, b) => a.sort_order - b.sort_order || a.size_ml - b.size_ml);
    const cheapest = byOrder.find((v) => !v.is_sample) ?? byOrder[0]; // the default size (see DEFAULT_VARIANT)
    const first = [...(p.media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: { name: p.brand.name, slug: p.brand.slug, is_original: p.brand.is_original },
      family: { name: p.family.name, slug: p.family.slug },
      descriptors: p.descriptors,
      concentration: p.concentration,
      concentration_label: CONCENTRATION_LABEL[p.concentration],
      gender: p.gender,
      size_label: cheapest ? `${CONCENTRATION_LABEL[p.concentration]} · ${cheapest.size_ml} ml` : CONCENTRATION_LABEL[p.concentration],
      // What "Add to bag" on a card puts in the bag: the default size (see DEFAULT_VARIANT).
      default_variant: cheapest ? { id: cheapest.id, label: cheapest.label, in_stock: cheapest.stock > 0 } : null,
      price_paise: cheapest?.price_paise ?? 0,
      mrp_paise: cheapest?.mrp_paise ?? null,
      has_sample: vs.some((v) => v.is_sample),
      in_stock: vs.some((v) => v.stock > 0),
      badge: p.badge,
      tint: p.tint,
      liquid: p.liquid,
      mono: p.mono,
      image: first ? this.r2.publicUrl(first.key) : null,
    };
  }
}
