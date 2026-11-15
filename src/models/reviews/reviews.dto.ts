import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { REVIEW_STATUSES } from './review.entities';

export class ReviewDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsOptional() @IsString() @MaxLength(1500) body?: string;
}

export class ReviewsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}

export class AdminReviewsQuery extends ReviewsQuery {
  @IsOptional() @IsIn(REVIEW_STATUSES as unknown as string[]) status?: string;
}

export class SetReviewStatusDto {
  @IsIn(REVIEW_STATUSES as unknown as string[]) status: (typeof REVIEW_STATUSES)[number];
}
