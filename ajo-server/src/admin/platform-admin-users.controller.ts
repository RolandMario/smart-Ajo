import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PlatformAdminUsersService } from './platform-admin-users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';

/**
 * Platform-admin-only directory of every user on the platform, for
 * ajo-admin-web's Users screen. Guarded by JwtAuthGuard + PlatformAdminGuard
 * — a regular `role: user` JWT is rejected with 403, even if otherwise
 * valid.
 */
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
@Controller('admin/users')
export class PlatformAdminUsersController {
  constructor(private platformAdminUsersService: PlatformAdminUsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto) {
    return this.platformAdminUsersService.listUsers(query);
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.platformAdminUsersService.getUserDetail(id);
  }

  /**
   * Credits an arbitrary user's wallet. Used by ajo-admin-web to manually
   * top up a member's balance (e.g. customer support adjustments).
   */
  @Post(':id/wallet/credit')
  creditWallet(@Param('id') id: string, @Body() dto: CreditWalletDto) {
    return this.platformAdminUsersService.creditWallet(
      id,
      dto.amount,
      dto.note,
    );
  }
}
