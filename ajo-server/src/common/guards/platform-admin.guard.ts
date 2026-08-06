import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '../enums/role.enum';
import { RequestUser } from '../decorators/current-user.decorator';

interface RequestWithUser extends Request {
  user: RequestUser;
}

/**
 * Restricts a route to users with role=platform_admin.
 *
 * Must be used AFTER JwtAuthGuard (e.g. @UseGuards(JwtAuthGuard, PlatformAdminGuard))
 * since it relies on request.user being populated.
 *
 * This is the ONLY global role check in the app — all other
 * group-specific permissions (e.g. isGroupAdmin) are checked against
 * GroupMember documents within the relevant feature modules.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user || user.role !== Role.PLATFORM_ADMIN) {
      throw new ForbiddenException('Platform admin access required');
    }

    return true;
  }
}
