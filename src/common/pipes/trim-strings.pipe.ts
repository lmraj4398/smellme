import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';

// Trims every string in request BODIES before validation, so "  Ravi " never
// reaches the database as a different value. Credentials are left byte-exact:
// a password trimmed on save but not on login would lock the user out.
const UNTRIMMED_KEY = /pass(word|wd|phrase)|secret|token|api[_-]?key|private[_-]?key|^otp$|otp[_-]?code/i;

export function trimDeep(value: unknown, key?: string): unknown {
  if (typeof value === 'string') return key && UNTRIMMED_KEY.test(key) ? value : value.trim();
  if (Array.isArray(value)) return value.map((item) => trimDeep(item, key));
  // Plain JSON objects only - never a Buffer, Date or uploaded file.
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, trimDeep(v, k)]),
    );
  }
  return value;
}

@Injectable()
export class TrimStringsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    return metadata.type === 'body' ? trimDeep(value) : value;
  }
}
