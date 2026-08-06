import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PlatformAdminFinanceService } from './platform-admin-finance.service';
import { ListWalletTransactionsQueryDto } from './dto/list-wallet-transactions-query.dto';
import { ListPayoutsQueryDto } from './dto/list-payouts-query.dto';
import { ListGroupWalletTransactionsQueryDto } from './dto/list-group-wallet-transactions-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';

/**
 * Platform-admin-only financial oversight endpoints, for
 * ajo-admin-web's Financial Oversight screen (Sub-phase D). Same
 * authorization shape as the other platform-admin controllers.
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/finance')
export class PlatformAdminFinanceController {
  constructor(private financeService: PlatformAdminFinanceService) {}

  @Get('wallet-transactions')
  listWalletTransactions(@Query() query: ListWalletTransactionsQueryDto) {
    return this.financeService.listWalletTransactions(query);
  }

  @Get('payouts')
  listPayouts(@Query() query: ListPayoutsQueryDto) {
    return this.financeService.listPayouts(query);
  }

  @Get('group-wallet-transactions')
  listGroupWalletTransactions(
    @Query() query: ListGroupWalletTransactionsQueryDto,
  ) {
    return this.financeService.listGroupWalletTransactions(query);
  }
}
