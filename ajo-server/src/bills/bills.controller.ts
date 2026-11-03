import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BillsService } from './bills.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { PurchaseAirtimeDto } from './dto/purchase-airtime.dto';
import { PurchaseDataDto } from './dto/purchase-data.dto';
import { PurchaseCableDto } from './dto/purchase-cable.dto';
import { RenewCableDto } from './dto/renew-cable.dto';
import { PurchaseElectricityDto } from './dto/purchase-electricity.dto';
import { ValidateMeterDto, ValidateSmartCardDto } from './dto/validate.dto';
import { CashbackQuoteQueryDto } from './dto/cashback-quote-query.dto';
import { ListBillHistoryQueryDto } from './dto/list-bill-history-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillsController {
  constructor(private bills: BillsService) {}

  @Post('validate/meter')
  validateMeter(
    @CurrentUser() user: RequestUser,
    @Body() dto: ValidateMeterDto,
  ) {
    return this.bills.validateMeter(dto.disco, dto.meterNumber, dto.meterType);
  }

  @Post('validate/smart-card')
  validateSmartCard(
    @CurrentUser() user: RequestUser,
    @Body() dto: ValidateSmartCardDto,
  ) {
    return this.bills.validateSmartCard(
      dto.serviceProvider,
      dto.smartCardNumber,
    );
  }

  @Post('airtime')
  purchaseAirtime(
    @CurrentUser() user: RequestUser,
    @Body() dto: PurchaseAirtimeDto,
  ) {
    return this.bills.purchaseAirtime(user.userId, dto);
  }

  @Post('data')
  purchaseData(@CurrentUser() user: RequestUser, @Body() dto: PurchaseDataDto) {
    return this.bills.purchaseData(user.userId, dto);
  }

  @Post('cable')
  purchaseCable(
    @CurrentUser() user: RequestUser,
    @Body() dto: PurchaseCableDto,
  ) {
    return this.bills.purchaseCable(user.userId, dto);
  }

  /** Renews the bouquet a verified decoder is already on (see `renewCable`). */
  @Post('cable/renew')
  renewCable(@CurrentUser() user: RequestUser, @Body() dto: RenewCableDto) {
    return this.bills.renewCable(user.userId, dto);
  }

  @Post('electricity')
  purchaseElectricity(
    @CurrentUser() user: RequestUser,
    @Body() dto: PurchaseElectricityDto,
  ) {
    return this.bills.purchaseElectricity(user.userId, dto);
  }

  @Get('services')
  getServices() {
    return this.bills.getActiveServiceTypes();
  }

  @Get('data-plans')
  getDataPlans(@Query('network') network: string = 'mtn') {
    return this.bills.getDataPlans(network);
  }

  @Get('cable-plans')
  getCablePlans(@Query('provider') provider: string = 'dstv') {
    return this.bills.getCablePlans(provider);
  }

  /**
   * Cashback the member would earn for a purchase they are about to confirm.
   * Powers the confirm screen's "You'll earn ₦0.5 cashback" banner.
   */
  @Get('cashback-quote')
  getCashbackQuote(@Query() query: CashbackQuoteQueryDto) {
    return this.bills.estimateCashback(query);
  }

  @Get('history')
  getHistory(
    @CurrentUser() user: RequestUser,
    @Query() query: ListBillHistoryQueryDto,
  ) {
    return this.bills.getHistory(user.userId, query);
  }

  @Get('receipts/:reference')
  getReceipt(
    @CurrentUser() user: RequestUser,
    @Param('reference') reference: string,
  ) {
    return this.bills.getReceipt(user.userId, reference);
  }
}
