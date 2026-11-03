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
import { SetBillPlanActiveDto } from './dto/set-bill-plan-active.dto';
import { SetBillPlanCashbackDto } from './dto/set-bill-plan-cashback.dto';
import { ListBillPlansQueryDto } from './dto/list-bill-plans-query.dto';
import { ListBillTransactionsQueryDto } from './dto/list-bill-transactions-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';

/**
 * Platform-admin-only bills configuration for ajo-admin-web. VTPass is the
 * single VTU provider, so the console can only synchronise its plan catalogue
 * into the database, toggle individual plans on/off (control over what shows in
 * the member app), and review every bill transaction on the platform.
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/bills')
export class PlatformAdminBillsController {
  constructor(private billsService: BillsService) {}

  /** Sync status + plan counts for every service category. */
  @Get('catalog')
  listCatalog() {
    return this.billsService.listCatalogStatus();
  }

  /** Pull & persist the VTpass plan catalogue for a category. */
  @Post('catalog/:serviceType/sync')
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

  /**
   * Set the cashback percentage for a single plan — data bundles, airtime
   * networks, cable bouquets and electricity discos all use this one route.
   */
  @Patch('plans/:id/cashback')
  setPlanCashback(
    @Param('id') id: string,
    @Body() dto: SetBillPlanCashbackDto,
  ) {
    return this.billsService.setPlanCashback(id, dto.cashbackPercent);
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
