import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Verifies the `Authorization: Bearer <CRON_SECRET>` header that Vercel
 * automatically attaches to every cron-job invocation.
 *
 * The SAME CRON_SECRET value must be configured in two places:
 *   1. the Vercel project's environment variables — so Vercel sends it as
 *      the authorization header on every cron request, and
 *   2. this server's environment — so the header can be verified here.
 *
 * Generate the value with: openssl rand -hex 32
 * (Vercel recommends a random string of at least 16 characters.)
 */
@Injectable()
export class CronAuthGuard implements CanActivate {
  private readonly logger = new Logger(CronAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = process.env.CRON_SECRET;

    if (!expected) {
      this.logger.warn(
        'CRON_SECRET is not configured — rejecting cron trigger. Set CRON_SECRET in the server environment.',
      );
      throw new ServiceUnavailableException('Cron triggers are not configured');
    }

    const authorization =
      request.get('authorization') ?? request.headers['authorization'];

    if (authorization !== `Bearer ${expected}`) {
      this.logger.warn(
        'Cron trigger rejected: Authorization header does not match CRON_SECRET',
      );
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}