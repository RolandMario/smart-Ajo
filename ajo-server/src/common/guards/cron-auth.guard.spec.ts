import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { CronAuthGuard } from './cron-auth.guard';

describe('CronAuthGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const makeContext = (authorization?: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          get: () => authorization,
          headers: { authorization },
        }),
      }),
    }) as unknown as ExecutionContext;

  it('allows a request whose Authorization matches CRON_SECRET', () => {
    process.env.CRON_SECRET = 'test-secret';
    const guard = new CronAuthGuard();
    expect(guard.canActivate(makeContext(`Bearer test-secret`))).toBe(true);
  });

  it('rejects a mismatched Authorization header', () => {
    process.env.CRON_SECRET = 'test-secret';
    const guard = new CronAuthGuard();
    expect(() => guard.canActivate(makeContext('Bearer wrong'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a request with no Authorization header', () => {
    process.env.CRON_SECRET = 'test-secret';
    const guard = new CronAuthGuard();
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('refuses to run when CRON_SECRET is not configured', () => {
    const guard = new CronAuthGuard();
    expect(() => guard.canActivate(makeContext('Bearer test-secret'))).toThrow(
      ServiceUnavailableException,
    );
  });
});