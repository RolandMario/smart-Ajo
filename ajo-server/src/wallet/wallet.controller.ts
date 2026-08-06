import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { FundWalletDto } from './dto/fund-wallet.dto';
import { SetBankAccountDto } from './dto/set-bank-account.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get('me')
  getWallet(@CurrentUser() user: RequestUser) {
    return this.walletService.getWalletSummary(user.userId);
  }

  @Post('fund/initialize')
  initializeFunding(
    @CurrentUser() user: RequestUser,
    @Body() dto: FundWalletDto,
  ) {
    return this.walletService.initializeFunding(user.userId, dto.amount);
  }

  @Get('fund/verify/:reference')
  verifyFunding(
    @CurrentUser() user: RequestUser,
    @Param('reference') reference: string,
  ) {
    return this.walletService.verifyFunding(user.userId, reference);
  }

  @Get('banks')
  listBanks() {
    return this.walletService.listBanks();
  }

  @Get('bank-account')
  getBankAccount(@CurrentUser() user: RequestUser) {
    return this.walletService.getBankAccount(user.userId);
  }

  @Post('bank-account')
  setBankAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: SetBankAccountDto,
  ) {
    return this.walletService.setBankAccount(user.userId, dto);
  }
}
