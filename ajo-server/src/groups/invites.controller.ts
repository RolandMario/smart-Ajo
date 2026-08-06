import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { RespondToInviteDto } from './dto/respond-to-invite.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('invites')
export class InvitesController {
  constructor(private groupsService: GroupsService) {}

  @Get('me')
  listMine(@CurrentUser() user: RequestUser) {
    return this.groupsService.listMyInvites(user.userId);
  }

  @Patch(':id/respond')
  respond(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: RespondToInviteDto,
  ) {
    return this.groupsService.respondToInvite(user.userId, id, dto.action);
  }
}
