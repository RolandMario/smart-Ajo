import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { inProcessCronsEnabled } from '../common/utils/environment';
import { SavingsService } from './savings.service';

/**
 * Runs every 10 minutes and auto-collects any savings plan whose next
 * interval has come due. Frequency is enforced through each plan's
 * `nextDueAt` (advanced by one interval on every successful collection),
 * so a 10-minute sweep is granular enough regardless of whether a plan
 * runs daily, weekly or monthly.
 */
@Injectable()
export class SavingsScheduler {
  private readonly logger = new Logger(SavingsScheduler.name);

  constructor(private savingsService: SavingsService) {}

  @Cron('*/10 * * * *')
  async processDueSavingPlans(): Promise<void> {
    if (!inProcessCronsEnabled()) {
      this.logger.log(
        'In-process cron disabled (DISABLE_IN_PROCESS_CRONS=true) — Vercel Cron drives this job',
      );
      return;
    }
    try {
      await this.savingsService.processDuePlans();
    } catch (err) {
      this.logger.error(`Savings auto-collect job failed: ${String(err)}`);
    }
  }
}
