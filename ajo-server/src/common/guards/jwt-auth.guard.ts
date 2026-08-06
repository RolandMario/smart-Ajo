import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Validates the JWT and attaches the authenticated user to the request.
 * Use this on any route that requires a logged-in user, regardless of
 * role (mobile user or platform_admin).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
