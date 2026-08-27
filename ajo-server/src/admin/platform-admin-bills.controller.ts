import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillsService } from '../bills/bills.service';
import { SetBillProviderDto } from './dto/set-bill-provider.dto';
import { SetBillPlanActiveDto } from './dto/set-bill-plan-active.dto';
import { ListBillPlansQueryDto } from './dto/list-bill-plans-query.dto';
import { ListBillTransactionsQueryDto } from './dto/list-bill-transactions-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';

/**
 * Platform-admin-only bills configuration for ajo-admin-web. Lets an admin
 * choose which VTU provider is active per service category, sync the provider's
 * plan catalog into the database, toggle individual plans on/off so they
 * show (or hide) in the member app, and review every bill transaction made
 * on the platform (via the Bills → Transactions screen).
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/bills')
export class PlatformAdminBillsController {
  constructor(private billsService: BillsService) {}

  /** Active provider + sync status for every service category. */
  @Get('providers')
  listProviders() {
    return this.billsService.listProviderConfigs();
  }

  /** Set which provider is active for a service category. */
  @Post('providers/:serviceType')
  setProvider(
    @Param('serviceType') serviceType: string,
    @Body() dto: SetBillProviderDto,
  ) {
    return this.billsService.setProvider(serviceType, dto.provider);
  }

  /** Pull & persist the active provider's plans for a category. */
  @Post('providers/:serviceType/sync')
  sync(@Param('serviceType') serviceType: string) {
    return this.billsService.syncPlans(serviceType);
  }

  /** All synced plans (including toggled-off ones). */
  @Get('plans')
  listPlans(@Query() query: ListBillPlansQueryDto) {
    return this.billsService.listPlansAdmin(query);
  }

  /** Turn a single plan on/off for the member app. */
  @Patch('plans/:id/active')
  setPlanActive(@Param('id') id: string, @Body() dto: SetBillPlanActiveDto) {
    return this.billsService.setPlanActive(id, dto.isActive);
  }

  /** Every bill transaction on the platform (all users), newest first. */
  @Get('transactions')
  listTransactions(@Query() query: ListBillTransactionsQueryDto) {
    return this.billsService.listTransactionsAdmin(query);
  }

  /** Full receipt for a single bill transaction, with the customer's identity. */
  @Get('transactions/:id')
  getTransaction(@Param('id') id: string) {
    return this.billsService.getReceiptAdmin(id);
  }
}
