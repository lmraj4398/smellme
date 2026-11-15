import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { WishlistItem } from './wishlist.entities';
import { WishlistController } from './wishlist.controllers';

@Module({
  imports: [TypeOrmModule.forFeature([WishlistItem]), CatalogModule, CustomersModule],
  controllers: [WishlistController],
})
export class WishlistModule {}
