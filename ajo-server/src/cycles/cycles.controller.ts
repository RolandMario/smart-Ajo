import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { EscrowService } from './escrow.service';
import { NotifyBankTransferDto } from './dto/notify-bank-transfer.dto';
import { RejectContributionDto } from './dto/reject-contribution.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId')
export class CyclesController {
  constructor(
    private cyclesService: CyclesService,
    private escrowService: EscrowService,
  ) {}

  /**
   * Activates the group: creates the first cycle + per-member wallets,
   * flips group status to ACTIVE.
   */
  @Post('activate')
  activate(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.cyclesService.activateGroup(user.userId, groupId);
  }

  @Get('cycles')
  listCycles(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.cyclesService.listCycles(user.userId, groupId);
  }

  @Get('cycles/current')
  getCurrentCycle(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.cyclesService.getCurrentCycle(user.userId, groupId);
  }

  /**
   * Member pays their own contribution from their wallet. Credits the
   * group's escrow account and marks the contribution PAID immediately.
   */
  @Post('contributions/:contributionId/pay')
  payFromWallet(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
  ) {
    return this.cyclesService.payContributionFromWallet(
      user.userId,
      groupId,
      contributionId,
    );
  }

  /**
   * Member says they've transferred into the group's escrow account and
   * asks the group admin to confirm it.
   */
  @Post('contributions/:contributionId/notify-transfer')
  notifyBankTransfer(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
    @Body() dto: NotifyBankTransferDto,
  ) {
    return this.cyclesService.notifyBankTransferPayment(
      user.userId,
      groupId,
      contributionId,
      dto.claimedReference,
    );
  }

  /**
   * Group admin confirms a claimed bank transfer (allocating the matching
   * escrow deposit when it has already landed).
   */
  @Post('contributions/:contributionId/confirm')
  confirmContribution(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
  ) {
    return this.cyclesService.confirmContributionPaid(
      user.userId,
      groupId,
      contributionId,
    );
  }

  /**
   * Group admin rejects a claimed bank transfer. The contribution goes back
   * to PENDING and the member's service fee is refunded to their wallet.
   */
  @Post('contributions/:contributionId/reject')
  rejectContribution(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Param('contributionId') contributionId: string,
    @Body() dto: RejectContributionDto,
  ) {
    return this.cyclesService.rejectContributionPayment(
      user.userId,
      groupId,
      contributionId,
      dto.reason,
    );
  }

  /** The group's escrow (DVA) details for members to transfer into. */
  @Get('escrow-account')
  getEscrowAccount(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.escrowService.getEscrowAccount(user.userId, groupId);
  }

  /** Admin-only. Re-provisions the group's escrow DVA (e.g. if invalidated). */
  @Post('escrow-account/refresh')
  refreshEscrowAccount(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.escrowService.refreshGroupEscrowAccount(user.userId, groupId);
  }

  /** Admin-only. Escrow deposits awaiting allocation, newest first. */
  @Get('escrow-deposits')
  listEscrowDeposits(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.escrowService.listDeposits(user.userId, groupId);
  }

  /**
   * Admin initiates a Paystack transfer of the pooled funds to the
   * cycle recipient's registered bank account. Requires ALL contributions
   * to be PAID first (every claimed bank transfer must be confirmed).
   */
  @Post('cycles/:cycleId/payout')
  initiatePayout(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.cyclesService.initiatePayout(user.userId, groupId, cycleId);
  }
}
