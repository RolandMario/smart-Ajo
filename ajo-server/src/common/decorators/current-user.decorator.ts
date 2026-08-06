import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Role } from '../enums/role.enum';

export interface RequestUser {
  userId: string;
  phone: string;
  email?: string;
  role: Role;
}

interface RequestWithUser extends Request {
  user: RequestUser;
}

/**
 * Usage: @CurrentUser() user: RequestUser
 * Must be used on routes protected by JwtAuthGuard.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
