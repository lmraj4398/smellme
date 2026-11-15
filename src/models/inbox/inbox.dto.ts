import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CONTACT_TOPICS } from './inbox.entities';

const lower = () => Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class ContactDto {
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  // Indian-style numbers with optional +91; kept loose because people type spaces and dashes.
  @IsOptional() @Matches(/^[+\d][\d\s-]{6,18}$/, { message: 'phone must be a valid phone number' }) phone?: string;
  @IsOptional() @lower() @IsEmail() @MaxLength(254) email?: string;
  @IsIn(CONTACT_TOPICS) topic: (typeof CONTACT_TOPICS)[number];
  @IsString() @IsNotEmpty() @MaxLength(3000) message: string;
  // Honeypot: hidden from people, so only bots fill it in.
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

export class NewsletterDto {
  @lower() @IsEmail() @MaxLength(254) email: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
}

export class InboxQuery {
  @IsOptional() @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value)) @IsBoolean() unread?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) limit?: number;
}

export class MarkReadDto {
  @IsBoolean() is_read: boolean;
}
