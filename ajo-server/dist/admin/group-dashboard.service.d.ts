import { Model } from 'mongoose';
import { GroupMemberDocument } from '../groups/schemas/group-member.schema';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { ContributionDocument } from '../cycles/schemas/contribution.schema';
import { GroupAccessService } from '../groups/group-access.service';
import { ContributionStatus } from '../common/enums/cycle.enum';
export interface MemberStanding {
    groupMemberId: string;
    user: {
        id: string;
        name?: string;
        phone: string;
        email?: string;
    };
    position: number | null;
    isGroupAdmin: boolean;
    payoutStatus: string;
    defaultCount: number;
    currentCycleStatus: ContributionStatus | null;
}
export interface DefaulterEntry {
    contributionId: string;
    cycleId: string;
    cycleNumber: number;
    dueDate: Date;
    amount: number;
    user: {
        id: string;
        name?: string;
        phone: string;
        email?: string;
    };
    defaultCount: number;
    flaggedAt?: Date;
}
export declare class GroupDashboardService {
    private groupMemberModel;
    private cycleModel;
    private contributionModel;
    private groupAccess;
    constructor(groupMemberModel: Model<GroupMemberDocument>, cycleModel: Model<CycleDocument>, contributionModel: Model<ContributionDocument>, groupAccess: GroupAccessService);
    listCurrentDefaulters(adminUserId: string, groupId: string): Promise<DefaulterEntry[]>;
    getMemberStandings(adminUserId: string, groupId: string): Promise<MemberStanding[]>;
    getContributionSummary(adminUserId: string, groupId: string): Promise<{
        paid: number;
        pending: number;
        defaulted: number;
        cycleId: string;
        cycleNumber: number;
        status: import("../common/enums/cycle.enum").CycleStatus;
        dueDate: Date;
    }[]>;
}
