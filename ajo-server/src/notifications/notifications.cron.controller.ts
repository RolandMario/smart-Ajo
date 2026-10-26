import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { CronAuthGuard } from '../common/guards/cron-auth.guard';
import { ReminderScheduler } from './reminder.scheduler';
import { DefaulterScheduler } from './defaulter.scheduler';

/**
 * Secure triggers for the group-level scheduled jobs (contribution
 * reminders, defaulter flagging). Vercel Cron (see vercel.json) fires these
 * GET endpoints on schedule; CronAuthGuard only admits requests carrying
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * The old `auto-collect` job is gone: contributions are member-initiated
 * (wallet debit or escrow bank transfer) and are never bulk-debited.
 */
@Controller('cron')
@UseGuards(CronAuthGuard)
export class NotificationsCronController {
  private readonly logger = new Logger(NotificationsCronController.name);

  constructor(
    private readonly reminderScheduler: ReminderScheduler,
    private readonly defaulterScheduler: DefaulterScheduler,
  ) {}

  @Get('reminders')
  async runReminders(): Promise<{
    ok: boolean;
    job: string;
    at: string;
  }> {
    this.logger.log('Cron trigger hit: contribution reminders');
    await this.reminderScheduler.sendContributionReminders();
    return {
      ok: true,
      job: 'contribution-reminders',
      at: new Date().toISOString(),
    };
  }

  @Get('defaulters')
  async runDefaulters(): Promise<{
    ok: boolean;
    job: string;
    at: string;
  }> {
    this.logger.log('Cron trigger hit: defaulter flagging');
    await this.defaulterScheduler.flagDefaulters();
    return {
      ok: true,
      job: 'defaulter-flagging',
      at: new Date().toISOString(),
    };
  }
}
