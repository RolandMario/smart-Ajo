import { CyclesService } from './cycles.service';
import type { RequestUser } from '../common/decorators/current-user.decorator';
export declare class CyclesController {
    private cyclesService;
    constructor(cyclesService: CyclesService);
    activate(user: RequestUser, groupId: string): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        isAdmin: boolean;
    }>;
    listCycles(user: RequestUser, groupId: string): Promise<{
        paidCount: number;
        _id: import("mongoose").Types.ObjectId;
        group: import("mongoose").Types.ObjectId;
        cycleNumber: number;
        recipientMember: {
            _id: import("mongoose").Types.ObjectId;
            position: number | null;
            user: {
                _id: import("mongoose").Types.ObjectId;
                name?: string;
                phone: string;
                email?: string;
            };
        };
        contributionAmount: number;
        totalSlots: number;
        dueDate: Date;
        status: import("../common/enums/cycle.enum").CycleStatus;
        completedAt?: Date;
        createdAt: Date;
        updatedAt: Date;
    }[]>;
    getCurrentCycle(user: RequestUser, groupId: string): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        isAdmin: boolean;
    }>;
    collectContributions(user: RequestUser, groupId: string, cycleId: string): Promise<{
        cycle: import("./interfaces/populated-cycle.interface").PopulatedCycle;
        contributions: import("./interfaces/populated-cycle.interface").PopulatedContribution[];
        isAdmin: boolean;
        results: {
            userId: string;
            success: boolean;
        }[];
    }>;
    initiatePayout(user: RequestUser, groupId: string, cycleId: string): Promise<(import("./schemas/payout.schema").Payout & import("mongoose").Document<import("mongoose").Types.ObjectId, any, any, Record<string, any>, {}> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    }) | null>;
}
