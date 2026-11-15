import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthedAdmin {
  id: string;
  type: 'admin';
  screens: string[] | null;
}

export const CurrentAdmin = createParamDecorator(
  (_d: unknown, ctx: ExecutionContext): AuthedAdmin => ctx.switchToHttp().getRequest().user,
);
