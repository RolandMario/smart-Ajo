"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var AutoCollectScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoCollectScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const cycle_schema_1 = require("../cycles/schemas/cycle.schema");
const group_schema_1 = require("../groups/schemas/group.schema");
const cycles_service_1 = require("../cycles/cycles.service");
const cycle_enum_1 = require("../common/enums/cycle.enum");
const group_enum_1 = require("../common/enums/group.enum");
let AutoCollectScheduler = AutoCollectScheduler_1 = class AutoCollectScheduler {
    cycleModel;
    groupModel;
    cyclesService;
    logger = new common_1.Logger(AutoCollectScheduler_1.name);
    constructor(cycleModel, groupModel, cyclesService) {
        this.cycleModel = cycleModel;
        this.groupModel = groupModel;
        this.cyclesService = cyclesService;
    }
    async autoCollectDueCycles() {
        this.logger.log('Running auto-collect job...');
        const now = new Date();
        const dueCycles = await this.cycleModel.find({
            status: cycle_enum_1.CycleStatus.OPEN,
            dueDate: { $lte: now },
        });
        if (dueCycles.length === 0) {
            this.logger.log('Auto-collect job done. No due cycles found.');
            return;
        }
        let groupsProcessed = 0;
        for (const cycle of dueCycles) {
            try {
                const group = await this.groupModel.findById(cycle.group);
                if (!group ||
                    group.status !== group_enum_1.GroupStatus.ACTIVE ||
                    !group.autoCollectEnabled) {
                    continue;
                }
                const results = await this.cyclesService.collectContributionsSystem(group, cycle);
                groupsProcessed += 1;
                const successCount = results.filter((r) => r.success).length;
                this.logger.log(`Auto-collected for group ${group._id.toString()} cycle ${cycle.cycleNumber}: ${successCount}/${results.length} succeeded.`);
            }
            catch (err) {
                this.logger.error(`Auto-collect failed for cycle ${cycle._id.toString()}: ${String(err)}`);
            }
        }
        this.logger.log(`Auto-collect job done. ${dueCycles.length} due cycle(s) checked, ${groupsProcessed} group(s) processed.`);
    }
};
exports.AutoCollectScheduler = AutoCollectScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_8AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AutoCollectScheduler.prototype, "autoCollectDueCycles", null);
exports.AutoCollectScheduler = AutoCollectScheduler = AutoCollectScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(cycle_schema_1.Cycle.name)),
    __param(1, (0, mongoose_1.InjectModel)(group_schema_1.Group.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        cycles_service_1.CyclesService])
], AutoCollectScheduler);
//# sourceMappingURL=auto-collect.scheduler.js.map