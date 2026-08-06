import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BillsService } from './bills.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';
import { PurchaseAirtimeDto } from './dto/purchase-airtime.dto';
import { PurchaseDataDto } from './dto/purchase-data.dto';
import { PurchaseCableDto } from './dto/purchase-cable.dto';
import { PurchaseElectricityDto } from './dto/purchase-electricity.dto';
import { ValidateMeterDto, ValidateSmartCardDto } from './dto/validate.dto';

@UseGuards(JwtAuthGuard)
@Controller('bills')
export class BillsController {
  constructor(private bills: BillsService) {}

  @Post('validate/meter')
  validateMeter(@CurrentUser() user: RequestUser, @Body() dto: ValidateMeterDto) {
    return this.bills.validateMeter(dto.disco, dto.meterNumber, dto.meterType);
  }

  @Post('validate/smart-card')
  validateSmartCard(@CurrentUser() user: RequestUser, @Body() dto: ValidateSmartCardDto) {
    return this.bills.validateSmartCard(dto.serviceProvider, dto.smartCardNumber);
  }

  @Post('airtime')
  purchaseAirtime(@CurrentUser() user: RequestUser, @Body() dto: PurchaseAirtimeDto) {
    return this.bills.purchaseAirtime(user.userId, dto);
  }

  @Post('data')
  purchaseData(@CurrentUser() user: RequestUser, @Body() dto: PurchaseDataDto) {
    return this.bills.purchaseData(user.userId, dto);
  }

  @Post('cable')
  purchaseCable(@CurrentUser() user: RequestUser, @Body() dto: PurchaseCableDto) {
    return this.bills.purchaseCable(user.userId, dto);
  }

  @Post('electricity')
  purchaseElectricity(@CurrentUser() user: RequestUser, @Body() dto: PurchaseElectricityDto) {
    return this.bills.purchaseElectricity(user.userId, dto);
  }

  @Get('data-plans')
  getDataPlans(@Query('network') network: string = 'mtn') {
    return this.bills.getDataPlans(network);
  }

  @Get('cable-plans')
  getCablePlans(@Query('provider') provider: string = 'dstv') {
    return this.bills.getCablePlans(provider);
  }

  @Get('history')
  getHistory(@CurrentUser() user: RequestUser) {
    return this.bills.getHistory(user.userId);
  }
}
