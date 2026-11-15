import { BadRequestException, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { decrypt, isEncryptedPayload } from '../crypto/aes';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Unwraps {data, iv, ts} request bodies.
//
// When API_REQUIRE_ENCRYPTED_BODY is on (default in production, and only
// meaningful with a key set), a plaintext JSON body on a write is refused -
// otherwise anyone could skip the encryption and its replay window by sending
// plain requests. Still allowed through: bodiless/empty requests (refresh,
// logout), multipart uploads (validated by the upload layer), and third-party
// webhooks that cannot speak our envelope.
@Injectable()
export class DecryptBodyMiddleware implements NestMiddleware {
  constructor(private readonly config: ConfigService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const body = req.body as unknown;

    if (isEncryptedPayload(body)) {
      try {
        req.body = JSON.parse(decrypt(body));
        return next();
      } catch (err: unknown) {
        if ((err as { code?: string }).code === 'TIMESTAMP_EXPIRED') {
          return next(new BadRequestException('Request timestamp expired or request replayed'));
        }
        return next(new BadRequestException('Invalid encrypted payload'));
      }
    }

    const required =
      this.config.get<boolean>('API_REQUIRE_ENCRYPTED_BODY') === true &&
      (this.config.get<string>('API_ENCRYPTION_KEY') ?? '').length === 64;
    const hasBody = body !== null && typeof body === 'object' && Object.keys(body as object).length > 0;
    const exempt =
      req.path.startsWith('/api/webhooks/') || (req.headers['content-type'] ?? '').startsWith('multipart/');

    if (required && WRITE_METHODS.has(req.method) && hasBody && !exempt) {
      return next(new BadRequestException('Encrypted payload required'));
    }
    next();
  }
}
