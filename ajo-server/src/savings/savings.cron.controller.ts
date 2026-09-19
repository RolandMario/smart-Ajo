import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { CronAuthGuard } from '../common/guards/cron-auth.guard';
import { SavingsService } from './savings.service';

/**
 * Secure trigger for the savings auto-debit job. Vercel Cron (see
 * vercel.json) fires GET /cron/savings on schedule; CronAuthGuard only
 * admits requests carrying `Authorization: Bearer ${CRON_SECRET}`.
 */
@Controller('cron')
@UseGuards(CronAuthGuard)
export class SavingsCronController {
  private readonly logger = new Logger(SavingsCronController.name);

  constructor(private readonly savingsService: SavingsService) {}

  @Get('savings')
  async runSavingsAutoCollect(): Promise<{
    ok: boolean;
    job: string;
    at: string;
  }> {
    this.logger.log('Cron trigger hit: savings auto-collect');
    await this.savingsService.processDuePlans();
    return {
      ok: true,
      job: 'savings-auto-collect',
      at: new Date().toISOString(),
    };
  }
}