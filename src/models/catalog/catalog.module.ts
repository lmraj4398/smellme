import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageService } from '../../common/storage/storage.service';
import { CatalogAdminController, CatalogPublicController, InventoryController, UploadsController } from './catalog.controllers';
import { InventoryService } from './inventory.service';
import { Product, ProductMedia, ProductNote, ProductVariant, StockLedger } from './entities/product.entities';
import { Brand, Note, ScentFamily } from './entities/taxonomy.entities';
import { ProductsAdminService } from './products-admin.service';
import { ProductsPublicService } from './products-public.service';
import { StockService } from './stock.service';
import { TaxonomyService } from './taxonomy.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Brand, ScentFamily, Note, Product, ProductVariant, ProductNote, ProductMedia, StockLedger]),
  ],
  controllers: [CatalogPublicController, CatalogAdminController, InventoryController, UploadsController],
  providers: [StorageService, StockService, TaxonomyService, ProductsAdminService, ProductsPublicService, InventoryService],
  // StockService is exported so the orders module (phase 5) decrements stock through the same ledger.
  exports: [StockService, StorageService, ProductsPublicService],
})
export class CatalogModule {}
