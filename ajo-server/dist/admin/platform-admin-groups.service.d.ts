import { Model } from 'mongoose';
import { GroupDocument } from '../groups/schemas/group.schema';
import { GroupMemberDocument } from '../groups/schemas/group-member.schema';
import { UserDocument } from '../users/schemas/user.schema';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { ContributionDocument } from '../cycles/schemas/contribution.schema';
import { GroupWalletDocument } from '../cycles/schemas/group-wallet.schema';
import { PayoutDocument } from '../cycles/schemas/payout.schema';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';
export interface PaginatedGroups {
    groups: Array<{
        id: string;
        name: string;
        status: string;
        contributionAmount: number;
        frequency: string;
        totalSlots: number;
        rotationMethod: string;
        autoCollectEnabled: boolean;
        currentCycleNumber: number | null;
        createdAt: Date;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface GroupMemberStanding {
    groupMemberId: string;
    user: {
        id: string;
        name?: string;
        phone: string;
        email?: string;
    };
    isGroupAdmin: boolean;
    inviteStatus: string;
    position: number | null;
    payoutStatus: string;
    defaultCount: number;
}
export interface GroupCycleSummary {
    cycleId: string;
    cycleNumber: number;
    status: string;
    dueDate: Date;
    contributionAmount: number;
    totalSlots: number;
    paidCount: number;
    defaultedCount: number;
    pendingCount: number;
    completedAt?: Date;
}
export interface GroupPayoutSummary {
    payoutId: string;
    cycleNumber: number;
    recipient: {
        id: string;
        name?: string;
        phone: string;
    };
    amount: number;
    status: string;
    failureReason?: string;
    completedAt?: Date;
    createdAt: Date;
}
export interface GroupDetail {
    id: string;
    name: string;
    status: string;
    contributionAmount: number;
    frequency: string;
    totalSlots: number;
    rotationMethod: string;
    autoCollectEnabled: boolean;
    currentCycleNumber: number | null;
    orderLockedAt?: Date;
    startDate?: Date;
    centralWalletBalance: number;
    admin?: {
        id: string;
        name?: string;
        phone: string;
    };
    members: GroupMemberStanding[];
    cycles: GroupCycleSummary[];
    payouts: GroupPayoutSummary[];
    createdAt: Date;
    updatedAt: Date;
}
export declare class PlatformAdminGroupsService {
    private groupModel;
    private groupMemberModel;
    private userModel;
    private cycleModel;
    private contributionModel;
    private groupWalletModel;
    private payoutModel;
    constructor(groupModel: Model<GroupDocument>, groupMemberModel: Model<GroupMemberDocument>, userModel: Model<UserDocument>, cycleModel: Model<CycleDocument>, contributionModel: Model<ContributionDocument>, groupWalletModel: Model<GroupWalletDocument>, payoutModel: Model<PayoutDocument>);
    listGroups(query: ListGroupsQueryDto): Promise<PaginatedGroups>;
    getGroupDetail(groupId: string): Promise<GroupDetail>;
    updateServiceFee(groupId: string, serviceFee: number | undefined): Promise<GroupDetail>;
    setAutoCollect(groupId: string, enabled: boolean): Promise<GroupDetail>;
}
