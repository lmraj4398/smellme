import { BadRequestException, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { ProductsPublicService } from '../catalog/products-public.service';
import { CurrentCustomer, CustomerRoute, type AuthedCustomer } from '../customers/customer.guard';
import { WishlistItem } from './wishlist.entities';

const MAX_ITEMS = 200;
const uuid = () => new ParseUUIDPipe({ version: '4' });

@ApiTags('Customer wishlist')
@ApiBearerAuth()
@CustomerRoute()
@Controller('customer/wishlist')
export class WishlistController {
  constructor(
    @InjectRepository(WishlistItem) private readonly items: Repository<WishlistItem>,
    private readonly products: ProductsPublicService,
  ) {}

  private async productIds(customerId: string) {
    const rows = await this.items.find({ where: { customer_id: customerId }, order: { created_at: 'DESC' }, take: MAX_ITEMS });
    return rows.map((r) => r.product_id);
  }

  /** Product cards, newest first. Products that are no longer on sale are left out. */
  @Get()
  async list(@CurrentCustomer() c: AuthedCustomer) {
    return this.products.visibleCards(await this.productIds(c.id));
  }

  /** Just the ids, so every heart on the site can show its state without loading whole cards. */
  @Get('ids')
  async ids(@CurrentCustomer() c: AuthedCustomer) {
    return { ids: await this.productIds(c.id) };
  }

  // Idempotent: hearting something already hearted is a success, not a conflict.
  @Put(':productId') @HttpCode(200)
  async add(@CurrentCustomer() c: AuthedCustomer, @Param('productId', uuid()) productId: string) {
    if (!(await this.products.isVisible(productId))) throw new NotFoundException('Fragrance not found');
    if ((await this.items.count({ where: { customer_id: c.id } })) >= MAX_ITEMS) {
      throw new BadRequestException(`Your wishlist can hold up to ${MAX_ITEMS} fragrances`);
    }
    await this.items.createQueryBuilder().insert().values({ customer_id: c.id, product_id: productId }).orIgnore().execute();
    return { ok: true };
  }

  @Delete(':productId') @HttpCode(200)
  async remove(@CurrentCustomer() c: AuthedCustomer, @Param('productId', uuid()) productId: string) {
    await this.items.delete({ customer_id: c.id, product_id: productId });
    return { ok: true };
  }
}
