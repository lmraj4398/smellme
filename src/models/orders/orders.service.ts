import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, QueryFailedError, Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { receiptKeyPattern, RECEIPT_MAX_BYTES, RECEIPT_TYPES, StorageService } from '../../common/storage/storage.service';
import { normalizeIndianMobile } from '../../common/utils/phone';
import { StockService } from '../catalog/stock.service';
import { CouponsService } from '../coupons/coupons.service';
import { Customer } from '../customers/customer.entities';
import { SettingsService } from '../settings/settings.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { Order, OrderEvent, OrderItem } from './order.entities';
import { CANCELLABLE, formatOrderNo, parseOrderNo, type OrderStatus } from './order-state';
import type { CreateOrderDto, PresignReceiptDto, SubmitReceiptDto } from './orders.dto';
import { PricingService, type PricedLine } from './pricing.service';

export const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN')}`;

const issueText = (l: PricedLine) =>
  l.issue === 'unavailable' ? 'an item in your bag is no longer available' : `${l.name} ${l.label} (${l.available ? `only ${l.available} left` : 'sold out'})`;

@Injectable()
export class OrdersService {
  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @InjectRepository(Order) readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) readonly items: Repository<OrderItem>,
    @InjectRepository(OrderEvent) readonly events: Repository<OrderEvent>,
    @InjectRepository(Customer) readonly customers: Repository<Customer>,
    private readonly pricing: PricingService,
    private readonly stock: StockService,
    private readonly coupons: CouponsService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ── placing an order ──────────────────────────────────────────────────────

  async create(customerId: string, dto: CreateOrderDto) {
    // A retry/double-click of the same checkout returns the order it already made.
    const prior = await this.orders.findOne({ where: { customer_id: customerId, client_ref: dto.client_ref } });
    if (prior) return this.viewMine(prior);

    const phone = normalizeIndianMobile(dto.address.phone);
    if (!phone) throw new BadRequestException('Enter a valid 10-digit mobile number for delivery');

    let orderId: string;
    try {
      orderId = await this.ds.transaction(async (m) => {
        const priced = await this.pricing.price(m, dto, customerId);
        if (!priced.lines.some((l) => !l.is_free_sample)) throw new BadRequestException('Your bag is empty');
        if (priced.issues.length) throw new ConflictException(`Please review your bag: ${priced.issues.map(issueText).join('; ')}`);
        if (dto.coupon_code?.trim() && priced.coupon_error) throw new BadRequestException(priced.coupon_error);

        const order = await m.save(
          Order,
          m.create(Order, {
            customer_id: customerId, client_ref: dto.client_ref, status: 'PENDING_PAYMENT',
            subtotal_paise: priced.subtotal_paise, discount_paise: priced.discount_paise, delivery_fee_paise: priced.delivery_fee_paise,
            gift_wrap_paise: priced.gift_wrap_paise, total_paise: priced.total_paise, coupon_code: priced.coupon?.code ?? null,
            gift_wrap: priced.gift_wrap_paise > 0, gift_message: (dto.gift_message ?? '').trim(), engraving: (dto.engraving ?? '').trim(),
            ship_name: dto.address.name.trim(), ship_phone: phone, ship_line1: dto.address.line1.trim(), ship_line2: (dto.address.line2 ?? '').trim(),
            ship_city: dto.address.city.trim(), ship_state: dto.address.state, ship_pincode: dto.address.pincode,
          }),
        );
        const no = formatOrderNo(order.order_seq);

        // Stock is held from this moment (including the free samples). Each deduction is one atomic
        // conditional UPDATE, so two customers can never both take the last bottle.
        for (const l of priced.lines) {
          try {
            await this.stock.change(m, { variantId: l.variant_id, delta: -l.qty, reason: 'sale', ref: no });
          } catch (e) {
            if (e instanceof ConflictException) throw new ConflictException(`${l.name} ${l.label} just sold out. Please review your bag.`);
            throw e;
          }
        }
        if (priced.coupon_id) await this.coupons.redeem(m, priced.coupon_id);

        await m.insert(OrderItem, priced.lines.map((l) => ({
          order_id: order.id, variant_id: l.variant_id, product_id: l.product_id, product_slug: l.product_slug, sku: l.sku, name: l.name, brand: l.brand,
          label: l.label, size_ml: l.size_ml, unit_price_paise: l.unit_price_paise, qty: l.qty, line_total_paise: l.line_total_paise,
          is_free_sample: l.is_free_sample, image_key: l.image_key,
        })));
        await m.insert(OrderEvent, { order_id: order.id, from_status: null, to_status: 'PENDING_PAYMENT', actor_type: 'customer', actor_id: customerId });
        return order.id;
      });
    } catch (e) {
      // Two identical submissions raced: the loser gets the winner's order.
      if (e instanceof QueryFailedError && (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code === '23505') {
        const winner = await this.orders.findOne({ where: { customer_id: customerId, client_ref: dto.client_ref } });
        if (winner) return this.viewMine(winner);
      }
      throw e;
    }

    const order = await this.orders.findOneByOrFail({ id: orderId });
    this.whatsapp.notify('order_placed', phone, [order.ship_name, formatOrderNo(order.order_seq), rupees(order.total_paise)], formatOrderNo(order.order_seq));
    return this.viewMine(order);
  }

  // ── reading ───────────────────────────────────────────────────────────────

  async listMine(customerId: string, page = 1) {
    const limit = 20;
    const [rows, total] = await this.orders.findAndCount({ where: { customer_id: customerId }, order: { created_at: 'DESC' }, skip: (page - 1) * limit, take: limit });
    const items = rows.length ? await this.items.find({ where: { order_id: In(rows.map((r) => r.id)) } }) : [];
    return {
      total, page, limit,
      items: rows.map((o) => ({
        order_no: formatOrderNo(o.order_seq), status: o.status, created_at: o.created_at, total_paise: o.total_paise,
        items: items.filter((i) => i.order_id === o.id && !i.is_free_sample).map((i) => ({ name: i.name, label: i.label, qty: i.qty })),
      })),
    };
  }

  /** Looks up by number AND owner: someone else's order number is simply "not found". */
  async findMine(customerId: string, orderNo: string): Promise<Order> {
    const seq = parseOrderNo(orderNo);
    const o = seq === null ? null : await this.orders.findOne({ where: { order_seq: seq, customer_id: customerId } });
    if (!o) throw new NotFoundException('Order not found');
    return o;
  }

  async getMine(customerId: string, orderNo: string) {
    return this.viewMine(await this.findMine(customerId, orderNo));
  }

  async viewMine(o: Order) {
    const items = await this.items.find({ where: { order_id: o.id }, order: { is_free_sample: 'ASC', name: 'ASC' } });
    const order_no = formatOrderNo(o.order_seq);
    // Payment instructions only while there is something to pay (or to pay again after a rejection).
    let payment: Record<string, unknown> | null = null;
    if (o.status === 'PENDING_PAYMENT') {
      const p = await this.settings.getPayment();
      payment = p.upi_vpa
        ? {
            upi_vpa: p.upi_vpa, payee_name: p.upi_payee_name, amount_paise: o.total_paise, reference: order_no,
            // No amount in the QR (by design): the customer must pay exactly `amount_paise`, shown beside it.
            upi_uri: `upi://pay?pa=${encodeURIComponent(p.upi_vpa)}&pn=${encodeURIComponent(p.upi_payee_name)}&tn=${encodeURIComponent(order_no)}&cu=INR`,
          }
        : { unavailable: true };
    }
    return {
      order_no, status: o.status, created_at: o.created_at,
      totals: { subtotal_paise: o.subtotal_paise, discount_paise: o.discount_paise, delivery_fee_paise: o.delivery_fee_paise, gift_wrap_paise: o.gift_wrap_paise, total_paise: o.total_paise },
      coupon_code: o.coupon_code, gift: { wrap: o.gift_wrap, message: o.gift_message, engraving: o.engraving },
      address: { name: o.ship_name, phone: o.ship_phone, line1: o.ship_line1, line2: o.ship_line2, city: o.ship_city, state: o.ship_state, pincode: o.ship_pincode },
      items: items.map((i) => ({ name: i.name, brand: i.brand, label: i.label, qty: i.qty, unit_price_paise: i.unit_price_paise, line_total_paise: i.line_total_paise, is_free_sample: i.is_free_sample, product_slug: i.product_slug })),
      payment, payment_submitted: !!o.receipt_key && o.status === 'PAYMENT_SUBMITTED', payment_reject_reason: o.status === 'PENDING_PAYMENT' ? o.payment_reject_reason : null,
      shipping: o.shipped_at ? { carrier: o.carrier, tracking_no: o.tracking_no, shipped_at: o.shipped_at } : null,
      timeline: { placed: o.created_at, payment_submitted: o.payment_submitted_at, paid: o.payment_verified_at, packed: o.packed_at, shipped: o.shipped_at, delivered: o.delivered_at, cancelled: o.cancelled_at },
      cancel_reason: o.cancel_reason, refund_due: o.refund_due, refunded: !!o.refunded_at,
      can_cancel: o.status === 'PENDING_PAYMENT', can_upload_receipt: o.status === 'PENDING_PAYMENT',
    };
  }

  // ── payment receipt ───────────────────────────────────────────────────────

  async presignReceipt(customerId: string, orderNo: string, dto: PresignReceiptDto) {
    const o = await this.findMine(customerId, orderNo);
    if (o.status !== 'PENDING_PAYMENT') throw new ConflictException('This order isn’t waiting for a payment receipt');
    return this.storage.presignReceiptUpload(o.id, dto.content_type, dto.size);
  }

  async submitReceipt(customerId: string, orderNo: string, dto: SubmitReceiptDto) {
    const o = await this.findMine(customerId, orderNo);
    if (o.status !== 'PENDING_PAYMENT') throw new ConflictException('This order isn’t waiting for a payment receipt');
    // The key must be one issued for THIS order. Pointing at another order's receipt (or any other object) fails here.
    if (!receiptKeyPattern(o.id).test(dto.key)) throw new BadRequestException('That receipt doesn’t belong to this order');
    const head = await this.storage.headReceipt(dto.key);
    if (!head) throw new BadRequestException('We couldn’t find your upload. Please upload the receipt again.');
    const ext = dto.key.split('.').pop()!;
    if (head.size <= 0 || head.size > RECEIPT_MAX_BYTES || RECEIPT_TYPES[head.contentType] !== ext) {
      throw new BadRequestException('The uploaded file isn’t a valid receipt (JPEG, PNG, WebP or PDF up to 5 MB)');
    }

    await this.ds.transaction(async (m) => {
      // Conditional on the status: two simultaneous submissions can't both move the order.
      const upd = await m.update(Order, { id: o.id, status: 'PENDING_PAYMENT' }, {
        status: 'PAYMENT_SUBMITTED', receipt_key: dto.key, utr: dto.utr?.toUpperCase() ?? null, paid_amount_paise: dto.paid_amount_paise ?? null,
        payment_submitted_at: new Date(), payment_reject_reason: null,
      });
      if (!upd.affected) throw new ConflictException('This order has just changed. Please refresh.');
      await m.insert(OrderEvent, { order_id: o.id, from_status: 'PENDING_PAYMENT', to_status: 'PAYMENT_SUBMITTED', actor_type: 'customer', actor_id: customerId, meta: { receipt_key: dto.key, utr: dto.utr ?? null, paid_amount_paise: dto.paid_amount_paise ?? null } } as QueryDeepPartialEntity<OrderEvent>);
    });
    return this.getMine(customerId, orderNo);
  }

  // ── cancelling ────────────────────────────────────────────────────────────

  /** A customer may cancel only before they have paid. After that, staff handle it (and any refund). */
  async cancelMine(customerId: string, orderNo: string) {
    const o = await this.findMine(customerId, orderNo);
    if (o.status !== 'PENDING_PAYMENT') throw new ConflictException('This order can’t be cancelled here. Please contact us.');
    await this.ds.transaction((m) => this.cancelInTx(m, o, 'customer', customerId, 'Cancelled by the customer'));
    return this.getMine(customerId, orderNo);
  }

  /** Shared by the customer and the admin: marks CANCELLED, returns every unit to stock, gives the coupon use back. */
  async cancelInTx(m: EntityManager, o: Order, by: 'customer' | 'admin', actorId: string, reason: string): Promise<{ refund_due: boolean }> {
    const prev = o.status;
    if (!CANCELLABLE.includes(prev)) throw new ConflictException('This order can no longer be cancelled');
    const refundDue = prev !== 'PENDING_PAYMENT'; // the customer may already have sent money
    const upd = await m.update(Order, { id: o.id, status: prev }, { status: 'CANCELLED', cancelled_at: new Date(), cancel_reason: reason, cancelled_by: by, refund_due: refundDue });
    if (!upd.affected) throw new ConflictException('The order has just changed. Please refresh and try again.');

    const no = formatOrderNo(o.order_seq);
    for (const i of await m.find(OrderItem, { where: { order_id: o.id } })) {
      await this.stock.change(m, { variantId: i.variant_id, delta: i.qty, reason: 'return', ref: no, note: 'Order cancelled', adminId: by === 'admin' ? actorId : null });
    }
    if (o.coupon_code) await this.coupons.release(m, o.coupon_code);
    await m.insert(OrderEvent, { order_id: o.id, from_status: prev as OrderStatus, to_status: 'CANCELLED', actor_type: by, actor_id: actorId, note: reason });
    return { refund_due: refundDue };
  }
}
