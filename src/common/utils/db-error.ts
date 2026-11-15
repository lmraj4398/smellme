import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Turns constraint violations into 409s with a message a person can act on,
// instead of a bare 500. Anything else is rethrown untouched.
export function rethrowDbError(e: unknown, what: string): never {
  if (e instanceof QueryFailedError) {
    const code = (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code;
    if (code === '23505') throw new ConflictException(`${what} already exists`);
    if (code === '23503') throw new ConflictException(`${what} is in use and cannot be removed`);
  }
  throw e;
}
