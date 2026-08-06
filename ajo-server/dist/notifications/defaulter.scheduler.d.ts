import { Model } from 'mongoose';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { ContributionDocument } from '../cycles/schemas/contribution.schema';
import { GroupDocument } from '../groups/schemas/group.schema';
import { GroupMemberDocument } from '../groups/schemas/group-member.schema';
import { NotificationsService } from './notifications.service';
import { UsersService } from '../users/users.service';
export declare class DefaulterScheduler {
    private cycleModel;
    private contributionModel;
    private groupModel;
    private groupMemberModel;
    private notificationsService;
    private usersService;
    private readonly logger;
    constructor(cycleModel: Model<CycleDocument>, contributionModel: Model<ContributionDocument>, groupModel: Model<GroupDocument>, groupMemberModel: Model<GroupMemberDocument>, notificationsService: NotificationsService, usersService: UsersService);
    flagDefaulters(): Promise<void>;
    flagCycleDefaulters(cycle: CycleDocument): Promise<number>;
    private notifyMember;
    private notifyAdmin;
}
