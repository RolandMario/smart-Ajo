import { Connection, Model, Types } from 'mongoose';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { ContributionDocument } from '../cycles/schemas/contribution.schema';
import { GroupWalletDocument } from '../cycles/schemas/group-wallet.schema';
import { Group, GroupDocument } from './schemas/group.schema';
import { GroupMember, GroupMemberDocument } from './schemas/group-member.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { ContinueGroupDto } from './dto/continue-group.dto';
import { InviteResponseAction } from './dto/respond-to-invite.dto';
import { LockRotationDto } from './dto/lock-rotation.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { GroupStatus, PayoutStatus } from '../common/enums/group.enum';
import { PopulatedGroupMember } from './interfaces/populated-group-member.interface';
import { UsersService } from '../users/users.service';
import { GroupAccessService } from './group-access.service';
import { NotificationsService } from '../notifications/notifications.service';
export declare class GroupsService {
    private groupModel;
    private groupMemberModel;
    private cycleModel;
    private contributionModel;
    private groupWalletModel;
    private connection;
    private usersService;
    private groupAccess;
    private notificationsService;
    constructor(groupModel: Model<GroupDocument>, groupMemberModel: Model<GroupMemberDocument>, cycleModel: Model<CycleDocument>, contributionModel: Model<ContributionDocument>, groupWalletModel: Model<GroupWalletDocument>, connection: Connection, usersService: UsersService, groupAccess: GroupAccessService, notificationsService: NotificationsService);
    private populateMember;
    private shuffle;
    private computeNextDueDate;
    private createCycleWithContributions;
    createGroup(userId: string, dto: CreateGroupDto): Promise<{
        group: GroupDocument;
        membership: GroupMemberDocument;
    }>;
    listMyGroups(userId: string): Promise<{
        group: (Group & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        }) | undefined;
        membership: {
            id: string;
            isGroupAdmin: boolean;
            position: number | null;
            payoutStatus: PayoutStatus;
        };
    }[]>;
    getGroupDetail(userId: string, groupId: string): Promise<{
        group: GroupDocument;
        members: PopulatedGroupMember[];
    }>;
    getMembers(userId: string, groupId: string): Promise<PopulatedGroupMember[]>;
    listMembers(groupId: string): Promise<PopulatedGroupMember[]>;
    inviteMember(adminUserId: string, groupId: string, phone: string): Promise<PopulatedGroupMember>;
    listMyInvites(userId: string): Promise<{
        inviteId: string;
        invitedAt: Date | undefined;
        group: (Group & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        }) | undefined;
    }[]>;
    respondToInvite(userId: string, groupMemberId: string, action: InviteResponseAction): Promise<PopulatedGroupMember>;
    lockRotation(adminUserId: string, groupId: string, dto: LockRotationDto): Promise<PopulatedGroupMember[]>;
    continueGroup(adminUserId: string, groupId: string, dto: ContinueGroupDto): Promise<{
        group: any;
        members: (import("mongoose").Document<unknown, {}, GroupMemberDocument, {}, import("mongoose").DefaultSchemaOptions> & GroupMember & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        } & {
            id: string;
        })[];
    }>;
    terminateGroup(adminUserId: string, groupId: string): Promise<{
        groupId: string;
        status: GroupStatus.TERMINATED;
    }>;
    setAutoCollect(adminUserId: string, groupId: string, enabled: boolean): Promise<{
        groupId: string;
        autoCollectEnabled: boolean;
    }>;
    updateGroup(adminUserId: string, groupId: string, dto: UpdateGroupDto): Promise<{
        group: (Group & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        }) | null;
        members: PopulatedGroupMember[];
    }>;
}
