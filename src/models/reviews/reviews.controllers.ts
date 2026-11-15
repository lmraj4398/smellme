import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlainResponse } from '../../common/decorators/plain-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Screen } from '../../common/decorators/screen.decorator';
import { CurrentCustomer, CustomerRoute, type AuthedCustomer } from '../customers/customer.guard';
import { AdminReviewsQuery, ReviewDto, ReviewsQuery, SetReviewStatusDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

const uuid = () => new ParseUUIDPipe({ version: '4' });

// Public like the catalog: plain (cacheable) because it holds nothing private. Authors are shown as "Anaya R.".
@ApiTags('Reviews (public)')
@Public()
@PlainResponse()
@Controller('products')
export class ReviewsPublicController {
  constructor(private readonly reviews: ReviewsService) {}

  @Header('Cache-Control', 'public, max-age=60')
  @Get(':slug/reviews')
  list(@Param('slug') slug: string, @Query() q: ReviewsQuery) { return this.reviews.listForProduct(slug, q.page, q.limit); }
}

@ApiTags('Reviews (customer)')
@ApiBearerAuth()
@CustomerRoute()
@Controller('customer/reviews')
export class CustomerReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Whether this customer may review the product (they received it), and their review if they already wrote one. */
  @Get(':productId')
  mine(@CurrentCustomer() c: AuthedCustomer, @Param('productId', uuid()) productId: string) { return this.reviews.mine(c.id, productId); }

  @Put(':productId') @HttpCode(200)
  save(@CurrentCustomer() c: AuthedCustomer, @Param('productId', uuid()) productId: string, @Body() dto: ReviewDto) {
    return this.reviews.save(c.id, productId, dto);
  }

  @Delete(':productId') @HttpCode(200)
  remove(@CurrentCustomer() c: AuthedCustomer, @Param('productId', uuid()) productId: string) { return this.reviews.remove(c.id, productId); }
}

@ApiTags('Reviews (admin)')
@ApiBearerAuth()
@Screen('reviews')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get() list(@Query() q: AdminReviewsQuery) { return this.reviews.adminList(q); }
  @Patch(':id') setStatus(@Param('id', uuid()) id: string, @Body() dto: SetReviewStatusDto) { return this.reviews.setStatus(id, dto.status); }
}
