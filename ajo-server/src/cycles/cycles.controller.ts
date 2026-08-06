import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId')
export class CyclesController {
  constructor(private cyclesService: CyclesService) {}

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
   * Automatically debit wallets of all members with PENDING contributions
   * for this cycle and credit the group's central account.
   * Members with insufficient wallet balance are skipped (contribution
   * stays PENDING until they top up and the admin runs this again).
   */
  @Post('cycles/:cycleId/collect-contributions')
  collectContributions(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
    @Param('cycleId') cycleId: string,
  ) {
    return this.cyclesService.collectContributions(
      user.userId,
      groupId,
      cycleId,
    );
  }

  /**
   * Admin initiates a Paystack transfer of the pooled funds to the
   * cycle recipient's registered bank account. Requires ALL contributions
   * to be PAID first (run collect-contributions first).
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
