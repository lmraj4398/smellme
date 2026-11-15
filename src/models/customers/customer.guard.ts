import { applyDecorators, CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';

export interface AuthedCustomer {
  id: string;
}

// Customer routes are @Public() as far as the global ADMIN guard is concerned, and are protected by this
// guard instead. The token `typ` is checked in both directions, so a customer token can never reach an
// admin route and an admin token can never reach a customer one.
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { customer?: AuthedCustomer }>();
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Unauthorized');
    try {
      const p = await this.jwt.verifyAsync<{ sub?: string; typ?: string }>(token, { algorithms: ['HS256'] });
      if (p.typ !== 'customer' || !p.sub) throw new Error('wrong token type');
      req.customer = { id: p.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Unauthorized');
    }
  }
}

/** Marks a route as customer-only: signed-in customer required, admin guard bypassed. */
export const CustomerRoute = () => applyDecorators(Public(), UseGuards(CustomerAuthGuard));

export const CurrentCustomer = createParamDecorator((_d: unknown, ctx: ExecutionContext): AuthedCustomer => ctx.switchToHttp().getRequest().customer);
