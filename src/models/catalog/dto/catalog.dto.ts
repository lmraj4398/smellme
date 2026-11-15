import { applyDecorators } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min,
  ValidateNested,
} from 'class-validator';
import { CONCENTRATIONS, GENDERS, NOTE_TIERS, STOCK_REASONS } from '../entities/product.entities';
import { MEDIA_KEY } from '../../../common/storage/storage.service';

const HEX = /^#[0-9A-Fa-f]{6}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hex = () => Matches(HEX, { message: 'must be a hex colour like #D7A260' });
const csv = () => Transform(({ value }) => (typeof value === 'string' ? value.split(',').map((s) => s.trim()).filter(Boolean) : value));
const bool = () => Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value));

// ── Taxonomy ────────────────────────────────────────────────────────────────

export class BrandDto {
  @IsString() @IsNotEmpty() @MaxLength(100) name: string;
  @IsOptional() @Matches(SLUG) @MaxLength(120) slug?: string;
  @IsOptional() @IsBoolean() is_original?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class FamilyDto {
  @IsString() @IsNotEmpty() @MaxLength(60) name: string;
  @IsOptional() @Matches(SLUG) @MaxLength(80) slug?: string;
  @IsOptional() @hex() tint?: string;
  @IsOptional() @hex() ink?: string;
  @IsOptional() @IsString() @MaxLength(120) notes_hint?: string;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sort_order?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
}

export class NoteDto {
  @IsString() @IsNotEmpty() @MaxLength(60) name: string;
  @IsOptional() @hex() color?: string;
}

// ── Products ────────────────────────────────────────────────────────────────

export class VariantDto {
  // Present = update this variant (it must belong to the product). Absent = new variant.
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9._-]+$/) @MaxLength(40) sku?: string;
  @IsString() @IsNotEmpty() @MaxLength(40) label: string;
  @IsInt() @Min(1) @Max(5000) size_ml: number;
  @IsInt() @Min(0) @Max(10_000_000) price_paise: number;
  @IsOptional() @IsInt() @Min(0) @Max(10_000_000) mrp_paise?: number | null;
  @IsOptional() @IsBoolean() is_sample?: boolean;
  // Opening stock for a NEW variant only. Existing stock changes go through /admin/inventory.
  @IsOptional() @IsInt() @Min(0) @Max(1_000_000) stock?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100_000) low_stock_at?: number;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sort_order?: number;
}

export class NoteRefDto {
  @IsUUID() note_id: string;
  @IsIn(NOTE_TIERS) tier: (typeof NOTE_TIERS)[number];
}

export class MediaDto {
  @Matches(MEDIA_KEY, { message: 'key is not a valid uploaded media key' }) key: string;
  @IsOptional() @IsString() @MaxLength(140) alt?: string;
}

const Level = () => applyDecorators(IsInt(), Min(1), Max(5));

export class ProductDto {
  @IsString() @IsNotEmpty() @MaxLength(140) name: string;
  @IsOptional() @Matches(SLUG) @MaxLength(140) slug?: string;
  @IsUUID() brand_id: string;
  @IsUUID() family_id: string;
  @IsOptional() @IsString() @MaxLength(80) descriptors?: string;
  @IsIn(CONCENTRATIONS) concentration: (typeof CONCENTRATIONS)[number];
  @IsIn(GENDERS) gender: (typeof GENDERS)[number];

  @IsOptional() @IsString() @MaxLength(2000) short_description?: string;
  @IsOptional() @IsString() @MaxLength(8000) story?: string;
  @IsOptional() @IsString() @MaxLength(4000) how_to_wear?: string;
  @IsOptional() @IsString() @MaxLength(8000) ingredients?: string;
  @IsOptional() @IsString() @MaxLength(30) badge?: string;

  @IsOptional() @hex() tint?: string;
  @IsOptional() @hex() liquid?: string;
  @IsOptional() @IsString() @MaxLength(4) mono?: string;

  @IsOptional() @IsString() @MaxLength(40) longevity_label?: string;
  @IsOptional() @Level() longevity_level?: number;
  @IsOptional() @IsString() @MaxLength(40) projection_label?: string;
  @IsOptional() @Level() projection_level?: number;
  @IsOptional() @IsString() @MaxLength(40) season_label?: string;
  @IsOptional() @Level() season_level?: number;
  @IsOptional() @IsString() @MaxLength(40) occasion_label?: string;
  @IsOptional() @Level() occasion_level?: number;

  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsBoolean() is_featured?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(9999) sort_order?: number;

  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => VariantDto) variants: VariantDto[];
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => NoteRefDto) notes: NoteRefDto[];
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => MediaDto) media: MediaDto[];
}

// ── Queries ─────────────────────────────────────────────────────────────────

export class PublicProductsQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @csv() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) family?: string[];
  @IsOptional() @csv() @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) brand?: string[];
  @IsOptional() @csv() @IsArray() @IsIn(GENDERS, { each: true }) gender?: string[];
  @IsOptional() @csv() @IsArray() @IsIn(CONCENTRATIONS, { each: true }) concentration?: string[];
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) price_min?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) price_max?: number;
  @IsOptional() @bool() @IsBoolean() sample?: boolean;
  @IsOptional() @IsIn(['pop', 'new', 'low', 'high']) sort?: 'pop' | 'new' | 'low' | 'high';
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(48) limit?: number;
}

export class AdminProductsQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @bool() @IsBoolean() active?: boolean;
  @IsOptional() @IsUUID() brand_id?: string;
  @IsOptional() @IsUUID() family_id?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class InventoryQuery {
  @IsOptional() @IsString() @MaxLength(80) q?: string;
  @IsOptional() @bool() @IsBoolean() low?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class AdjustStockDto {
  // Signed: +24 received, -2 damaged. Zero would be a no-op ledger row.
  @IsInt() @Min(-1_000_000) @Max(1_000_000) delta: number;
  @IsIn(STOCK_REASONS.filter((r) => r !== 'sale' && r !== 'opening')) reason: (typeof STOCK_REASONS)[number];
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

export class PresignDto {
  @IsString() @MaxLength(40) content_type: string;
  @IsInt() @Min(1) @Max(50 * 1024 * 1024) size: number;
}
