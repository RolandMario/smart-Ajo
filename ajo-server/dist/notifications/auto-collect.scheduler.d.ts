import { Model } from 'mongoose';
import { CycleDocument } from '../cycles/schemas/cycle.schema';
import { GroupDocument } from '../groups/schemas/group.schema';
import { CyclesService } from '../cycles/cycles.service';
export declare class AutoCollectScheduler {
    private cycleModel;
    private groupModel;
    private cyclesService;
    private readonly logger;
    constructor(cycleModel: Model<CycleDocument>, groupModel: Model<GroupDocument>, cyclesService: CyclesService);
    autoCollectDueCycles(): Promise<void>;
}
