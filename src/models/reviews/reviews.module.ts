import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { Product } from '../catalog/entities/product.entities';
import { CustomersModule } from '../customers/customers.module';
import { AdminReviewsController, CustomerReviewsController, ReviewsPublicController } from './reviews.controllers';
import { ProductReview } from './review.entities';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [TypeOrmModule.forFeature([ProductReview, Product]), CatalogModule, CustomersModule],
  controllers: [ReviewsPublicController, CustomerReviewsController, AdminReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
