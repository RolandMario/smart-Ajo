import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from './schemas/group-member.schema';
import { InviteStatus } from '../common/enums/group.enum';

/**
 * Shared group/membership lookup + authorization helpers, used by
 * GroupsService and CyclesService alike. Keeping these in one place
 * means "is this user allowed to act on this group?" is answered
 * consistently everywhere.
 */
@Injectable()
export class GroupAccessService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
  ) {}

  async getGroupOrThrow(groupId: string): Promise<GroupDocument> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid group id');
    }
    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return group;
  }

  async getMembership(
    groupId: Types.ObjectId,
    userId: string,
  ): Promise<GroupMemberDocument | null> {
    return this.groupMemberModel.findOne({
      group: groupId,
      user: new Types.ObjectId(userId),
    });
  }

  /**
   * Throws unless `userId` is the admin of `groupId`. Returns the
   * admin's GroupMember document so callers can reuse it if needed.
   */
  async assertGroupAdmin(
    groupId: Types.ObjectId,
    userId: string,
  ): Promise<GroupMemberDocument> {
    const membership = await this.getMembership(groupId, userId);

    if (!membership || !membership.isGroupAdmin) {
      throw new ForbiddenException(
        'Only the group admin can perform this action',
      );
    }

    return membership;
  }

  /**
   * Throws unless `userId` is an ACCEPTED member of `groupId`. Returns
   * the member's GroupMember document.
   */
  async assertAcceptedMember(
    groupId: Types.ObjectId,
    userId: string,
  ): Promise<GroupMemberDocument> {
    const membership = await this.getMembership(groupId, userId);

    if (!membership || membership.inviteStatus !== InviteStatus.ACCEPTED) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return membership;
  }
}
