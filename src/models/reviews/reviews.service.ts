import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Product } from '../catalog/entities/product.entities';
import { ProductsPublicService } from '../catalog/products-public.service';
import { ReviewDto } from './reviews.dto';
import { ProductReview, type ReviewStatus } from './review.entities';

const DEFAULT_LIMIT = 10;

/** "Anaya Rao" -> "Anaya R." so a review never shows a full name. */
const displayName = (full: string | null | undefined) => {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SmellMe customer';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
};

const toPublic = (r: { id: string; rating: number; title: string; body: string; created_at: Date; name: string | null }) => ({
  id: r.id, rating: Number(r.rating), title: r.title, body: r.body, created_at: r.created_at, author: displayName(r.name), verified: true,
});

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ProductReview) private readonly reviews: Repository<ProductReview>,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly catalog: ProductsPublicService,
  ) {}

  private async productBySlug(slug: string) {
    const p = await this.products.findOne({ where: { slug }, select: { id: true } });
    if (!p || !(await this.catalog.isVisible(p.id))) throw new NotFoundException('Fragrance not found');
    return p.id;
  }

  /** Has this customer received (not just ordered) a paid-for bottle or sample of the product? Free samples don't count. */
  async hasBought(customerId: string, productId: string): Promise<boolean> {
    const rows = await this.ds.query(
      `SELECT 1 FROM orders o JOIN order_items i ON i.order_id = o.id
       WHERE o.customer_id = $1 AND o.status = 'DELIVERED' AND i.product_id = $2 AND i.is_free_sample = false LIMIT 1`,
      [customerId, productId],
    );
    return rows.length > 0;
  }

  // ── public ──────────────────────────────────────────────────────────────

  async summary(productId: string) {
    const rows: { rating: number; n: string }[] = await this.reviews
      .createQueryBuilder('r').select('r.rating', 'rating').addSelect('COUNT(*)', 'n')
      .where('r.product_id = :productId AND r.status = :s', { productId, s: 'published' }).groupBy('r.rating').getRawMany();
    const distribution: Record<string, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let count = 0, sum = 0;
    for (const r of rows) { const n = Number(r.n); distribution[String(r.rating)] = n; count += n; sum += n * Number(r.rating); }
    return { count, average: count ? Math.round((sum / count) * 10) / 10 : 0, distribution };
  }

  async listForProduct(slug: string, page = 1, limit = DEFAULT_LIMIT) {
    const productId = await this.productBySlug(slug);
    const rows = await this.reviews
      .createQueryBuilder('r').leftJoin('customers', 'c', 'c.id = r.customer_id')
      .select(['r.id AS id', 'r.rating AS rating', 'r.title AS title', 'r.body AS body', 'r.created_at AS created_at', 'c.name AS name'])
      .where('r.product_id = :productId AND r.status = :s', { productId, s: 'published' })
      .orderBy('r.created_at', 'DESC').offset((page - 1) * limit).limit(limit).getRawMany();
    const summary = await this.summary(productId);
    return { summary, page, limit, items: rows.map(toPublic) };
  }

  // ── the signed-in customer ──────────────────────────────────────────────

  async mine(customerId: string, productId: string) {
    const review = await this.reviews.findOne({ where: { customer_id: customerId, product_id: productId } });
    const can_review = review ? true : await this.hasBought(customerId, productId);
    return {
      can_review,
      review: review ? { id: review.id, rating: review.rating, title: review.title, body: review.body, status: review.status } : null,
    };
  }

  async save(customerId: string, productId: string, dto: ReviewDto) {
    if (!(await this.catalog.isVisible(productId))) throw new NotFoundException('Fragrance not found');
    const existing = await this.reviews.findOne({ where: { customer_id: customerId, product_id: productId } });
    if (!existing && !(await this.hasBought(customerId, productId))) {
      throw new ForbiddenException('Only customers whose order has been delivered can review a fragrance');
    }
    const fields = { rating: dto.rating, title: (dto.title ?? '').trim(), body: (dto.body ?? '').trim() };
    // Editing keeps the owner's moderation decision: a hidden review stays hidden after an edit.
    const saved = existing
      ? await this.reviews.save(Object.assign(existing, fields))
      : await this.reviews.save(this.reviews.create({ customer_id: customerId, product_id: productId, ...fields, status: 'published' }));
    return { id: saved.id, rating: saved.rating, title: saved.title, body: saved.body, status: saved.status };
  }

  async remove(customerId: string, productId: string) {
    await this.reviews.delete({ customer_id: customerId, product_id: productId });
    return { ok: true };
  }

  // ── admin ───────────────────────────────────────────────────────────────

  async adminList(q: { status?: string; page?: number; limit?: number }) {
    const page = q.page ?? 1, limit = q.limit ?? 20;
    const qb = this.reviews
      .createQueryBuilder('r').leftJoin('customers', 'c', 'c.id = r.customer_id').leftJoin('products', 'p', 'p.id = r.product_id')
      .select(['r.id AS id', 'r.rating AS rating', 'r.title AS title', 'r.body AS body', 'r.status AS status', 'r.created_at AS created_at',
        'c.name AS customer_name', 'c.phone AS customer_phone', 'p.name AS product_name', 'p.slug AS product_slug']);
    if (q.status) qb.where('r.status = :status', { status: q.status });
    const [rows, total] = await Promise.all([qb.clone().orderBy('r.created_at', 'DESC').offset((page - 1) * limit).limit(limit).getRawMany(), qb.getCount()]);
    const hidden = await this.reviews.count({ where: { status: 'hidden' } });
    return { total, page, limit, hidden, items: rows.map((r) => ({ ...r, rating: Number(r.rating) })) };
  }

  async setStatus(id: string, status: ReviewStatus) {
    const r = await this.reviews.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Review not found');
    r.status = status;
    await this.reviews.save(r);
    return { id: r.id, status: r.status };
  }
}
