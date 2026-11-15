import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

class Paged {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class ErrorGroupsQuery extends Paged {
  @IsOptional() @IsIn(['error', 'warning']) severity?: 'error' | 'warning';
}

export class ErrorEntriesQuery extends Paged {
  @IsString() @MaxLength(200) group: string;
}

export class ClearGroupQuery {
  @IsString() @MaxLength(200) group: string;
}
