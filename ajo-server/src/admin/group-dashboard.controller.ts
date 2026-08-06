import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { GroupDashboardService } from './group-dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

/**
 * Group-admin dashboard endpoints — for the admin of a SPECIFIC group to
 * see defaulters, member standings, and contribution history for their
 * own group. Not to be confused with the platform_admin web dashboard
 * (which monitors all groups/users across the platform).
 */
@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId/dashboard')
export class GroupDashboardController {
  constructor(private dashboardService: GroupDashboardService) {}

  @Get('defaulters')
  listDefaulters(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.dashboardService.listCurrentDefaulters(user.userId, groupId);
  }

  @Get('standings')
  getStandings(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.dashboardService.getMemberStandings(user.userId, groupId);
  }

  @Get('contribution-summary')
  getContributionSummary(
    @CurrentUser() user: RequestUser,
    @Param('groupId') groupId: string,
  ) {
    return this.dashboardService.getContributionSummary(user.userId, groupId);
  }
}
