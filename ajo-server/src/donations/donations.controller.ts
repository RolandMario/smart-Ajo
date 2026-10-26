import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { DonationsService } from './donations.service';
import { CreateDonationGroupDto } from './dto/create-donation-group.dto';
import { JoinDonationGroupDto } from './dto/join-donation-group.dto';
import { DonateDto } from './dto/donate.dto';
import { CreateDonationPayoutDto } from './dto/create-donation-payout.dto';
import { SetDonationPayoutAccountDto } from './dto/set-payout-account.dto';
import { ListDonationsQueryDto } from './dto/list-donations-query.dto';
import { SetTerminationVoteDto } from './dto/set-termination-vote.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

/**
 * Pool collections (donation pools). Every route requires a signed-in user;
 * admin-only routes verify the pool owner in the service.
 */
@UseGuards(JwtAuthGuard)
@Controller('donations')
export class DonationsController {
  constructor(private donationsService: DonationsService) {}

  /** Creates a pool; the creator becomes its admin and first member. */
  @Post('groups')
  createGroup(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateDonationGroupDto,
  ) {
    return this.donationsService.createGroup(user.userId, dto);
  }

  /** Every pool the caller belongs to (as admin or member) + dashboard stats. */
  @Get('groups')
  listGroups(@CurrentUser() user: RequestUser) {
    return this.donationsService.listGroups(user.userId);
  }

  /** Joins a pool by its shared Group ID. Idempotent. */
  @Post('groups/join')
  joinGroup(
    @CurrentUser() user: RequestUser,
    @Body() dto: JoinDonationGroupDto,
  ) {
    return this.donationsService.joinGroup(user.userId, dto.groupId);
  }

  /** Pool detail: totals, my giving, donation window, recent donations. */
  @Get('groups/:id')
  getGroup(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.donationsService.getGroup(user.userId, id);
  }

  /** Paginated donor history, newest first (any member). */
  @Get('groups/:id/donations')
  listDonations(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query() query: ListDonationsQueryDto,
  ) {
    return this.donationsService.listDonations(user.userId, id, query);
  }

  /** Donates from the wallet for the current period (one per period). */
  @Post('groups/:id/donate')
  donate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: DonateDto,
  ) {
    return this.donationsService.donate(user.userId, id, dto);
  }

  /**
   * Casts or withdraws the caller's vote for the pool to be terminated.
   * Members who have not paid 100% of their pool contribution get a 400.
   */
  @Put('groups/:id/termination-vote')
  setTerminationVote(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetTerminationVoteDto,
  ) {
    return this.donationsService.voteOnTermination(user.userId, id, dto.vote);
  }

  /**
   * Admin-only: ends the pool once 2/3 of the fully paid members voted yes
   * AND everything donated has been paid out. The service re-checks both
   * conditions, so a stale screen cannot terminate a pool early.
   *
   * Termination deletes the pool and every record scoped to it (donations,
   * memberships, payouts, escrow movements) in one transaction, so the pool
   * disappears from every list instead of lingering as `terminated`.
   */
  @Post('groups/:id/terminate')
  terminateGroup(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.donationsService.terminateGroup(user.userId, id);
  }

  /** Admin-only: paginated payout history + current escrow balance. */
  @Get('groups/:id/payouts')
  listPayouts(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Query() query: ListDonationsQueryDto,
  ) {
    return this.donationsService.listPayouts(user.userId, id, query);
  }

  /** Admin-only: pays escrow to the configured bank account. */
  @Post('groups/:id/payouts')
  initiatePayout(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: CreateDonationPayoutDto,
  ) {
    return this.donationsService.initiatePayout(user.userId, id, dto);
  }

  /** Admin-only: where this pool's payouts currently go. */
  @Get('groups/:id/payout-account')
  getPayoutAccount(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.donationsService.getPayoutAccount(user.userId, id);
  }

  /** Admin-only: override the destination, or reset to the admin's account. */
  @Put('groups/:id/payout-account')
  setPayoutAccount(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetDonationPayoutAccountDto,
  ) {
    return this.donationsService.setPayoutAccount(user.userId, id, dto);
  }
}
