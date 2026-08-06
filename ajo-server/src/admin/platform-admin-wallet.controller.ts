import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminWalletService } from './platform-admin-wallet.service';
import { WithdrawAdminWalletDto } from './dto/withdraw-admin-wallet.dto';
import { SetBankAccountDto } from '../wallet/dto/set-bank-account.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

/**
 * Platform-admin-only wallet endpoints for viewing accumulated service
 * fees and withdrawing them to a bank account.
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/wallet')
export class PlatformAdminWalletController {
  constructor(private adminWalletService: PlatformAdminWalletService) {}

  /**
   * Returns the admin wallet summary: balance, bank account, and recent
   * service fee credit transactions.
   */
  @Get()
  getAdminWallet() {
    return this.adminWalletService.getAdminWallet();
  }

  /**
   * Withdraws funds from the admin wallet to the admin's registered bank
   * account via Paystack transfer.
   */
  @Post('withdraw')
  withdraw(
    @CurrentUser() user: RequestUser,
    @Body() dto: WithdrawAdminWalletDto,
  ) {
    return this.adminWalletService.withdraw(user.userId, dto.amount);
  }

  /**
   * Gets the admin's bank account for withdrawals.
   */
  @Get('bank-account')
  getBankAccount(@CurrentUser() user: RequestUser) {
    return this.adminWalletService.getBankAccount(user.userId);
  }

  /**
   * Sets the admin's bank account for withdrawals.
   */
  @Post('bank-account')
  setBankAccount(
    @CurrentUser() user: RequestUser,
    @Body() dto: SetBankAccountDto,
  ) {
    return this.adminWalletService.setBankAccount(user.userId, dto);
  }

  /**
   * Lists Nigerian banks for the bank account setup form.
   */
  @Get('banks')
  listBanks() {
    return this.adminWalletService.listBanks();
  }
}