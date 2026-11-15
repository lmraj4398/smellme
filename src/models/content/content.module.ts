import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogModule } from '../catalog/catalog.module';
import { ContentAdminController, ContentPublicController } from './content.controllers';
import { ContentService } from './content.service';
import { SiteContent } from './site-content.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SiteContent]), CatalogModule], // CatalogModule exports StorageService
  controllers: [ContentPublicController, ContentAdminController],
  providers: [ContentService],
})
export class ContentModule {}
