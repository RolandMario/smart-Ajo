import { Connection, Model, Types } from 'mongoose';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { ContributionDocument } from '../cycles/schemas/contribution.schema';
import { GroupWalletDocument } from '../cycles/schemas/group-wallet.schema';
import { GroupWalletTransactionDocument } from '../cycles/schemas/group-wallet-transaction.schema';
import { EscrowDepositDocument } from '../cycles/schemas/escrow-deposit.schema';
import { PayoutDocument } from '../cycles/schemas/payout.schema';
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
export interface TerminatedGroupPurgeResult {
    scanned: number;
    purged: Array<{
        id: string;
        name: string;
    }>;
    skipped: Array<{
        id: string;
        name: string;
        balance: number;
    }>;
    dryRun: boolean;
}
export declare class GroupsService {
    private groupModel;
    private groupMemberModel;
    private cycleModel;
    private contributionModel;
    private groupWalletModel;
    private groupWalletTxModel;
    private escrowDepositModel;
    private payoutModel;
    private connection;
    private usersService;
    private groupAccess;
    private notificationsService;
    constructor(groupModel: Model<GroupDocument>, groupMemberModel: Model<GroupMemberDocument>, cycleModel: Model<CycleDocument>, contributionModel: Model<ContributionDocument>, groupWalletModel: Model<GroupWalletDocument>, groupWalletTxModel: Model<GroupWalletTransactionDocument>, escrowDepositModel: Model<EscrowDepositDocument>, payoutModel: Model<PayoutDocument>, connection: Connection, usersService: UsersService, groupAccess: GroupAccessService, notificationsService: NotificationsService);
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
    searchGroupByCode(userId: string, code: string): Promise<{
        group: Group & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        };
        memberCount: number;
        isMember: boolean;
        isAdmin: boolean;
        isFull: boolean;
        joinable: boolean;
    }>;
    joinGroupByCode(userId: string, code: string): Promise<{
        group: Group & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        };
        membership: PopulatedGroupMember;
    }>;
    private findGroupByJoinCode;
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
        status: GroupStatus;
    }>;
    purgeGroup(groupId: Types.ObjectId): Promise<void>;
    purgeTerminatedGroups(options?: {
        dryRun?: boolean;
    }): Promise<TerminatedGroupPurgeResult>;
    updateGroup(adminUserId: string, groupId: string, dto: UpdateGroupDto): Promise<{
        group: (Group & import("mongoose").Document<Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
            _id: Types.ObjectId;
        }> & {
            __v: number;
        }) | null;
        members: PopulatedGroupMember[];
    }>;
}
