import { GroupDashboardService } from './group-dashboard.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class GroupDashboardController {
    private dashboardService;
    constructor(dashboardService: GroupDashboardService);
    listDefaulters(user: RequestUser, groupId: string): Promise<import("./group-dashboard.service").DefaulterEntry[]>;
    getStandings(user: RequestUser, groupId: string): Promise<import("./group-dashboard.service").MemberStanding[]>;
    getContributionSummary(user: RequestUser, groupId: string): Promise<{
        paid: number;
        pending: number;
        defaulted: number;
        cycleId: string;
        cycleNumber: number;
        status: import("../common/enums/cycle.enum").CycleStatus;
        dueDate: Date;
    }[]>;
}
