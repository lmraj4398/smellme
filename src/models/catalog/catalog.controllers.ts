import { Body, Controller, Delete, Get, Header, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthedAdmin, CurrentAdmin } from '../../common/decorators/current-user.decorator';
import { PlainResponse } from '../../common/decorators/plain-response.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Screen } from '../../common/decorators/screen.decorator';
import { StorageService } from '../../common/storage/storage.service';
import {
  AdjustStockDto, AdminProductsQuery, BrandDto, FamilyDto, InventoryQuery, NoteDto, PresignDto, ProductDto, PublicProductsQuery,
} from './dto/catalog.dto';
import { InventoryService } from './inventory.service';
import { ProductsAdminService } from './products-admin.service';
import { ProductsPublicService } from './products-public.service';
import { TaxonomyService } from './taxonomy.service';

const uuid = () => new ParseUUIDPipe({ version: '4' });
// Public catalog data is not sensitive, so it is sent unencrypted and CDN-cacheable.
const CACHE = 'public, max-age=60, stale-while-revalidate=300';

// ── Public (storefront) ─────────────────────────────────────────────────────

@ApiTags('Catalog (public)')
@Public()
@PlainResponse()
@Controller()
export class CatalogPublicController {
  constructor(private readonly products: ProductsPublicService, private readonly taxonomy: TaxonomyService) {}

  @Header('Cache-Control', CACHE) @Get('products') list(@Query() q: PublicProductsQuery) { return this.products.list(q); }
  @Header('Cache-Control', CACHE) @Get('products/filters') filters() { return this.products.filters(); }
  @Header('Cache-Control', CACHE) @Get('products/:slug') get(@Param('slug') slug: string) { return this.products.get(slug); }
  @Header('Cache-Control', CACHE) @Get('samples') samples() { return this.products.samples(); }
  @Header('Cache-Control', CACHE) @Get('brands') brands() { return this.taxonomy.listBrands(true); }
  @Header('Cache-Control', CACHE) @Get('families') families() { return this.taxonomy.listFamilies(true); }
}

// ── Admin: products + taxonomy (screen "products") ──────────────────────────

@ApiTags('Catalog (admin)')
@ApiBearerAuth()
@Screen('products')
@Controller('admin')
export class CatalogAdminController {
  constructor(private readonly products: ProductsAdminService, private readonly taxonomy: TaxonomyService) {}

  @Get('products') list(@Query() q: AdminProductsQuery) { return this.products.list(q); }
  @Get('products/:id') get(@Param('id', uuid()) id: string) { return this.products.get(id); }
  @Post('products') create(@Body() dto: ProductDto, @CurrentAdmin() a: AuthedAdmin) { return this.products.create(dto, a.id); }
  @Put('products/:id') update(@Param('id', uuid()) id: string, @Body() dto: ProductDto, @CurrentAdmin() a: AuthedAdmin) {
    return this.products.update(id, dto, a.id);
  }
  @Patch('products/:id/active') setActive(@Param('id', uuid()) id: string, @Body('is_active') active: boolean) {
    return this.products.setActive(id, active === true);
  }

  @Get('brands') brands() { return this.taxonomy.listBrands(); }
  @Post('brands') createBrand(@Body() dto: BrandDto) { return this.taxonomy.createBrand(dto); }
  @Put('brands/:id') updateBrand(@Param('id', uuid()) id: string, @Body() dto: BrandDto) { return this.taxonomy.updateBrand(id, dto); }
  @Delete('brands/:id') @HttpCode(200) async removeBrand(@Param('id', uuid()) id: string) { await this.taxonomy.removeBrand(id); return { ok: true }; }

  @Get('families') families() { return this.taxonomy.listFamilies(); }
  @Post('families') createFamily(@Body() dto: FamilyDto) { return this.taxonomy.createFamily(dto); }
  @Put('families/:id') updateFamily(@Param('id', uuid()) id: string, @Body() dto: FamilyDto) { return this.taxonomy.updateFamily(id, dto); }
  @Delete('families/:id') @HttpCode(200) async removeFamily(@Param('id', uuid()) id: string) { await this.taxonomy.removeFamily(id); return { ok: true }; }

  @Get('notes') notes() { return this.taxonomy.listNotes(); }
  @Post('notes') createNote(@Body() dto: NoteDto) { return this.taxonomy.createNote(dto); }
  @Put('notes/:id') updateNote(@Param('id', uuid()) id: string, @Body() dto: NoteDto) { return this.taxonomy.updateNote(id, dto); }
  @Delete('notes/:id') @HttpCode(200) async removeNote(@Param('id', uuid()) id: string) { await this.taxonomy.removeNote(id); return { ok: true }; }
}

// ── Admin: inventory (screen "inventory") ───────────────────────────────────

@ApiTags('Inventory')
@ApiBearerAuth()
@Screen('inventory')
@Controller('admin/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get() list(@Query() q: InventoryQuery) { return this.inventory.list(q); }
  @Get(':variantId/ledger') ledger(@Param('variantId', uuid()) id: string, @Query('page') page?: string) {
    return this.inventory.history(id, Math.max(1, Number(page) || 1));
  }
  @Post(':variantId/adjust') @HttpCode(200)
  adjust(@Param('variantId', uuid()) id: string, @Body() dto: AdjustStockDto, @CurrentAdmin() a: AuthedAdmin) {
    return this.inventory.adjust(id, dto, a.id);
  }
}

// ── Admin: image uploads (any signed-in admin; content editors need it too) ─

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  // The browser then PUTs the file straight to R2; the API never handles the bytes.
  @Post('presign') @HttpCode(200)
  presign(@Body() dto: PresignDto) {
    return this.storage.presignImageUpload(dto.content_type, dto.size);
  }
}
