import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { encrypt } from '../crypto/aes';
import { PLAIN_RESPONSE_KEY } from '../decorators/plain-response.decorator';

@Injectable()
export class EncryptResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.switchToHttp().getRequest();

    // Third-party callbacks (WhatsApp delivery webhooks) can't read our envelope.
    if (request?.path?.startsWith('/api/webhooks/')) return next.handle();

    const plain = this.reflector.getAllAndOverride<boolean>(PLAIN_RESPONSE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (plain) return next.handle();

    return next.handle().pipe(map((data) => encrypt(JSON.stringify(data ?? null))));
  }
}
