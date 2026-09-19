import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { CronAuthGuard } from '../common/guards/cron-auth.guard';
import { AutoCollectScheduler } from './auto-collect.scheduler';
import { ReminderScheduler } from './reminder.scheduler';
import { DefaulterScheduler } from './defaulter.scheduler';

/**
 * Secure triggers for the group-level scheduled jobs (auto-collect,
 * contribution reminders, defaulter flagging). Vercel Cron (see
 * vercel.json) fires these GET endpoints on schedule; CronAuthGuard only
 * admits requests carrying `Authorization: Bearer ${CRON_SECRET}`.
 */
@Controller('cron')
@UseGuards(CronAuthGuard)
export class NotificationsCronController {
  private readonly logger = new Logger(NotificationsCronController.name);

  constructor(
    private readonly autoCollectScheduler: AutoCollectScheduler,
    private readonly reminderScheduler: ReminderScheduler,
    private readonly defaulterScheduler: DefaulterScheduler,
  ) {}

  @Get('auto-collect')
  async runAutoCollect(): Promise<{
    ok: boolean;
    job: string;
    at: string;
  }> {
    this.logger.log('Cron trigger hit: group auto-collect');
    await this.autoCollectScheduler.autoCollectDueCycles();
    return {
      ok: true,
      job: 'auto-collect',
      at: new Date().toISOString(),
    };
  }

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