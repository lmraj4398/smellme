import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { StorageService } from '../../common/storage/storage.service';
import { Customer } from '../customers/customer.entities';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Order, OrderEvent, OrderItem } from './order.entities';
import { canMove, formatOrderNo, parseOrderNo, ORDER_STATUSES, type OrderStatus } from './order-state';
import type { AdminOrdersQuery, ApproveDto, ShipDto } from './orders.dto';
import { isStatus } from './orders.dto';
import { OrdersService, rupees } from './orders.service';

@Injectable()
export class OrdersAdminService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
    @InjectRepository(OrderEvent) private readonly events: Repository<OrderEvent>,
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    private readonly customerOrders: OrdersService,
    private readonly storage: StorageService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ── reading ───────────────────────────────────────────────────────────────

  async list(q: AdminOrdersQuery) {
    const page = q.page ?? 1;
    const limit = 30;
    const qb = this.orders.createQueryBuilder('o').innerJoin(Customer, 'c', 'c.id = o.customer_id')
      .select(['o.id AS id', 'o.order_seq AS order_seq', 'o.status AS status', 'o.total_paise AS total_paise', 'o.created_at AS created_at',
        'o.payment_submitted_at AS payment_submitted_at', 'o.paid_amount_paise AS paid_amount_paise', 'o.ship_name AS ship_name', 'o.ship_city AS ship_city',
        'c.phone AS phone', 'c.name AS customer_name']);

    if (isStatus(q.status)) qb.andWhere('o.status = :st', { st: q.status });
    else if (q.status) qb.andWhere('false'); // an unknown status matches nothing rather than everything
    const term = q.q?.trim();
    if (term) {
      const seq = parseOrderNo(term);
      const digits = term.replace(/\D/g, '');
      const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(`(${seq !== null ? 'o.order_seq = :seq OR ' : ''}${digits.length >= 4 ? 'c.phone LIKE :dg OR ' : ''}o.ship_name ILIKE :like OR c.name ILIKE :like OR o.utr ILIKE :like)`,
        { seq, dg: `%${digits}%`, like });
    }
    const total = await qb.clone().getCount();
    // The verification queue is first-come-first-served; everything else shows newest first.
    if (q.status === 'PAYMENT_SUBMITTED') qb.orderBy('o.payment_submitted_at', 'ASC');
    else qb.orderBy('o.created_at', 'DESC');
    const rows = await qb.offset((page - 1) * limit).limit(limit).getRawMany();
    return { total, page, limit, items: rows.map((r) => ({ ...r, order_no: formatOrderNo(r.order_seq) })) };
  }

  /** Counts for the dashboard and the sidebar badges. */
  async summary() {
    const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
    for (const r of await this.orders.query('SELECT status, count(*)::int AS n FROM orders GROUP BY status')) byStatus[r.status as OrderStatus] = r.n;
    const today = await this.orders.query(
      `SELECT COALESCE(SUM(total_paise), 0)::bigint AS sales, count(*)::int AS orders
       FROM orders WHERE payment_verified_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
       AND status NOT IN ('CANCELLED','REFUNDED')`,
    );
    const low = await this.orders.query('SELECT count(*)::int AS n FROM product_variants WHERE is_active AND stock <= low_stock_at');
    const refunds = await this.orders.query(`SELECT count(*)::int AS n FROM orders WHERE status = 'CANCELLED' AND refund_due`);
    return {
      by_status: byStatus,
      awaiting_verification: byStatus.PAYMENT_SUBMITTED,
      to_pack: byStatus.PAID,
      to_ship: byStatus.PACKED,
      refunds_due: refunds[0].n,
      low_stock_variants: low[0].n,
      today: { verified_sales_paise: Number(today[0].sales), verified_orders: today[0].orders },
    };
  }

  async detail(id: string) {
    const o = await this.orders.findOne({ where: { id } });
    if (!o) throw new NotFoundException('Order not found');
    const [items, events, customer] = await Promise.all([
      this.items.find({ where: { order_id: id }, order: { is_free_sample: 'ASC', name: 'ASC' } }),
      this.events.find({ where: { order_id: id }, order: { created_at: 'ASC' } }),
      this.customers.findOneByOrFail({ id: o.customer_id }),
    ]);
    const dupes = o.utr
      ? await this.orders.query(`SELECT order_seq, status FROM orders WHERE utr = $1 AND id <> $2 AND status NOT IN ('CANCELLED','REFUNDED')`, [o.utr, id])
      : [];
    return {
      id: o.id, order_no: formatOrderNo(o.order_seq), status: o.status, created_at: o.created_at,
      customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email },
      address: { name: o.ship_name, phone: o.ship_phone, line1: o.ship_line1, line2: o.ship_line2, city: o.ship_city, state: o.ship_state, pincode: o.ship_pincode },
      totals: { subtotal_paise: o.subtotal_paise, discount_paise: o.discount_paise, delivery_fee_paise: o.delivery_fee_paise, gift_wrap_paise: o.gift_wrap_paise, total_paise: o.total_paise },
      coupon_code: o.coupon_code, gift: { wrap: o.gift_wrap, message: o.gift_message, engraving: o.engraving },
      items: items.map((i) => ({ name: i.name, brand: i.brand, label: i.label, sku: i.sku, qty: i.qty, unit_price_paise: i.unit_price_paise, line_total_paise: i.line_total_paise, is_free_sample: i.is_free_sample })),
      payment: {
        has_receipt: !!o.receipt_key, utr: o.utr, claimed_amount_paise: o.paid_amount_paise, expected_amount_paise: o.total_paise,
        // The QR carries no amount, so the amount actually paid is the customer's claim: surface any difference loudly.
        amount_mismatch: o.paid_amount_paise !== null && o.paid_amount_paise !== o.total_paise,
        duplicate_utr_orders: dupes.map((d: { order_seq: number; status: string }) => ({ order_no: formatOrderNo(d.order_seq), status: d.status })),
        submitted_at: o.payment_submitted_at, verified_at: o.payment_verified_at, reject_reason: o.payment_reject_reason,
      },
      shipping: { carrier: o.carrier, tracking_no: o.tracking_no, packed_at: o.packed_at, shipped_at: o.shipped_at, delivered_at: o.delivered_at },
      cancel: { at: o.cancelled_at, reason: o.cancel_reason, by: o.cancelled_by, refund_due: o.refund_due, refunded_at: o.refunded_at, refund_note: o.refund_note },
      events: events.map((e) => ({ at: e.created_at, from: e.from_status, to: e.to_status, actor: e.actor_type, note: e.note, meta: e.meta })),
    };
  }

  /** A 5-minute signed link. The receipt bucket is private and this is the only way to look at one. */
  async receiptUrl(id: string) {
    const o = await this.orders.findOne({ where: { id }, select: { id: true, receipt_key: true } });
    if (!o) throw new NotFoundException('Order not found');
    if (!o.receipt_key) throw new NotFoundException('No receipt uploaded');
    return { url: await this.storage.signedReceiptUrl(o.receipt_key, 300), expires_in: 300, is_pdf: o.receipt_key.endsWith('.pdf') };
  }

  // ── payment verification ──────────────────────────────────────────────────

  async approve(id: string, dto: ApproveDto, adminId: string) {
    const o = await this.require(id);
    if (o.status !== 'PAYMENT_SUBMITTED') throw new ConflictException(`This order is ${o.status.toLowerCase().replace('_', ' ')}, not awaiting verification`);
    if (!o.receipt_key) throw new ConflictException('There is no receipt to verify');
    if (o.paid_amount_paise !== null && o.paid_amount_paise !== o.total_paise && !dto.confirm_amount_mismatch) {
      throw new ConflictException(`The customer says they paid ${rupees(o.paid_amount_paise)} but the order total is ${rupees(o.total_paise)}. Confirm the amount you actually received to approve.`);
    }
    if (o.utr && !dto.confirm_duplicate_utr) {
      const dupes = await this.orders.query(`SELECT order_seq FROM orders WHERE utr = $1 AND id <> $2 AND status NOT IN ('CANCELLED','REFUNDED')`, [o.utr, id]);
      if (dupes.length) throw new ConflictException(`This payment reference was also used on ${dupes.map((d: { order_seq: number }) => formatOrderNo(d.order_seq)).join(', ')}. Confirm it is genuine to approve.`);
    }
    await this.move(id, 'PAYMENT_SUBMITTED', 'PAID', { payment_verified_at: new Date(), payment_verified_by: adminId }, adminId, null, { amount_mismatch_confirmed: !!dto.confirm_amount_mismatch, duplicate_utr_confirmed: !!dto.confirm_duplicate_utr });
    await this.tell(o, 'payment_approved', (c) => [c, formatOrderNo(o.order_seq)]);
    return this.detail(id);
  }

  async reject(id: string, reason: string, adminId: string) {
    const o = await this.require(id);
    // Back to PENDING_PAYMENT so the customer can pay/upload again. The rejected receipt stays in the event history.
    await this.move(id, 'PAYMENT_SUBMITTED', 'PENDING_PAYMENT', { payment_reject_reason: reason, utr: null, paid_amount_paise: null }, adminId, reason, { rejected_receipt_key: o.receipt_key });
    await this.tell(o, 'payment_rejected', (c) => [c, formatOrderNo(o.order_seq), reason]);
    return this.detail(id);
  }

  // ── fulfilment ────────────────────────────────────────────────────────────

  async pack(id: string, adminId: string) {
    await this.move(id, 'PAID', 'PACKED', { packed_at: new Date() }, adminId);
    return this.detail(id);
  }

  async ship(id: string, dto: ShipDto, adminId: string) {
    const o = await this.require(id);
    await this.move(id, 'PACKED', 'SHIPPED', { shipped_at: new Date(), carrier: dto.carrier.trim(), tracking_no: dto.tracking_no.trim() }, adminId, `${dto.carrier} ${dto.tracking_no}`);
    await this.tell(o, 'shipped', (c) => [c, formatOrderNo(o.order_seq), dto.carrier.trim(), dto.tracking_no.trim()]);
    return this.detail(id);
  }

  async deliver(id: string, adminId: string) {
    const o = await this.require(id);
    await this.move(id, 'SHIPPED', 'DELIVERED', { delivered_at: new Date() }, adminId);
    await this.tell(o, 'delivered', (c) => [c, formatOrderNo(o.order_seq)]);
    return this.detail(id);
  }

  async cancel(id: string, reason: string, adminId: string) {
    const o = await this.require(id);
    await this.ds.transaction((m) => this.customerOrders.cancelInTx(m, o, 'admin', adminId, reason));
    await this.tell(o, 'cancelled', (c) => [c, formatOrderNo(o.order_seq), reason]);
    return this.detail(id);
  }

  async refund(id: string, note: string, adminId: string) {
    const o = await this.require(id);
    if (!o.refund_due) throw new ConflictException('No refund is due on this order');
    await this.move(id, 'CANCELLED', 'REFUNDED', { refunded_at: new Date(), refund_note: note, refund_due: false }, adminId, note);
    return this.detail(id);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async require(id: string): Promise<Order> {
    const o = await this.orders.findOne({ where: { id } });
    if (!o) throw new NotFoundException('Order not found');
    return o;
  }

  /** One conditional UPDATE (status must still be `from`) plus its history row, in a transaction. */
  private async move(id: string, from: OrderStatus, to: OrderStatus, patch: Partial<Order>, adminId: string, note: string | null = null, meta: Record<string, unknown> | null = null) {
    if (!canMove(from, to)) throw new ConflictException('That change isn’t allowed');
    await this.ds.transaction(async (m: EntityManager) => {
      const cur = await m.findOne(Order, { where: { id }, select: { id: true, status: true } });
      if (!cur) throw new NotFoundException('Order not found');
      if (cur.status !== from) throw new ConflictException(`This order is ${cur.status.toLowerCase().replace('_', ' ')}, so it can’t move to ${to.toLowerCase().replace('_', ' ')}`);
      const upd = await m.update(Order, { id, status: from }, { status: to, ...patch } as never);
      if (!upd.affected) throw new ConflictException('The order has just changed. Please refresh and try again.');
      await m.insert(OrderEvent, { order_id: id, from_status: from, to_status: to, actor_type: 'admin', actor_id: adminId, note, meta } as QueryDeepPartialEntity<OrderEvent>);
    });
  }

  private async tell(o: Order, event: Parameters<WhatsAppService['notify']>[0], params: (greetingName: string) => string[]) {
    const c = await this.customers.findOne({ where: { id: o.customer_id } });
    if (c) this.whatsapp.notify(event, c.phone, params(o.ship_name || c.name || 'there'), formatOrderNo(o.order_seq));
  }
}
