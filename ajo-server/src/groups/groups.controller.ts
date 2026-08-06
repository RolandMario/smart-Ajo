import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { ContinueGroupDto } from './dto/continue-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { LockRotationDto } from './dto/lock-rotation.dto';
import { SetAutoCollectDto } from './dto/set-auto-collect.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(user.userId, dto);
  }

  @Get()
  listMine(@CurrentUser() user: RequestUser) {
    return this.groupsService.listMyGroups(user.userId);
  }

  @Get(':id')
  getDetail(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.groupsService.getGroupDetail(user.userId, id);
  }

  @Get(':id/members')
  getMembers(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.groupsService.getMembers(user.userId, id);
  }

  @Post(':id/invites')
  invite(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.groupsService.inviteMember(user.userId, id, dto.phone);
  }

  @Post(':id/rotation/lock')
  lockRotation(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: LockRotationDto,
  ) {
    return this.groupsService.lockRotation(user.userId, id, dto);
  }

  /**
   * Toggles automatic contribution collection for this group. When
   * enabled, AutoCollectScheduler debits member wallets once the
   * current cycle's dueDate arrives without admin intervention.
   */
  @Patch(':id/auto-collect')
  setAutoCollect(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: SetAutoCollectDto,
  ) {
    return this.groupsService.setAutoCollect(user.userId, id, dto.enabled);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(user.userId, id, dto);
  }

  /**
   * Admin-only. Starts a new round of cycles for a completed group.
   * The admin may optionally update settings (contribution amount,
   * frequency, total slots) before continuing.
   */
  @Post(':id/continue')
  continue(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: ContinueGroupDto,
  ) {
    return this.groupsService.continueGroup(user.userId, id, dto);
  }

  /**
   * Admin-only. Permanently terminates a completed group.
   * The group is hidden from the mobile app and marked as TERMINATED
   * in the admin web panel.
   */
  @Post(':id/terminate')
  terminate(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.groupsService.terminateGroup(user.userId, id);
  }
}
