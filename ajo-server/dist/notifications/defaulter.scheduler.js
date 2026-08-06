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
var DefaulterScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DefaulterScheduler = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const cycle_schema_1 = require("../cycles/schemas/cycle.schema");
const contribution_schema_1 = require("../cycles/schemas/contribution.schema");
const group_schema_1 = require("../groups/schemas/group.schema");
const group_member_schema_1 = require("../groups/schemas/group-member.schema");
const notifications_service_1 = require("./notifications.service");
const notification_events_1 = require("./notification-events");
const cycle_enum_1 = require("../common/enums/cycle.enum");
const group_enum_1 = require("../common/enums/group.enum");
const users_service_1 = require("../users/users.service");
let DefaulterScheduler = DefaulterScheduler_1 = class DefaulterScheduler {
    cycleModel;
    contributionModel;
    groupModel;
    groupMemberModel;
    notificationsService;
    usersService;
    logger = new common_1.Logger(DefaulterScheduler_1.name);
    constructor(cycleModel, contributionModel, groupModel, groupMemberModel, notificationsService, usersService) {
        this.cycleModel = cycleModel;
        this.contributionModel = contributionModel;
        this.groupModel = groupModel;
        this.groupMemberModel = groupMemberModel;
        this.notificationsService = notificationsService;
        this.usersService = usersService;
    }
    async flagDefaulters() {
        this.logger.log('Running defaulter flagging job...');
        const now = new Date();
        const overdueCycles = await this.cycleModel.find({
            status: cycle_enum_1.CycleStatus.OPEN,
            dueDate: { $lt: now },
        });
        let totalFlagged = 0;
        for (const cycle of overdueCycles) {
            const flagged = await this.flagCycleDefaulters(cycle);
            totalFlagged += flagged;
        }
        this.logger.log(`Defaulter flagging done. ${overdueCycles.length} overdue cycle(s) checked, ${totalFlagged} contribution(s) flagged.`);
    }
    async flagCycleDefaulters(cycle) {
        try {
            const group = await this.groupModel.findById(cycle.group);
            if (!group || group.status !== group_enum_1.GroupStatus.ACTIVE)
                return 0;
            const pendingContributions = await this.contributionModel.find({
                cycle: cycle._id,
                status: cycle_enum_1.ContributionStatus.PENDING,
            });
            if (pendingContributions.length === 0)
                return 0;
            const now = new Date();
            for (const contribution of pendingContributions) {
                contribution.status = cycle_enum_1.ContributionStatus.DEFAULTED;
                contribution.flaggedAt = now;
                await contribution.save();
                await this.groupMemberModel.updateOne({ _id: contribution.member }, { $inc: { defaultCount: 1 } });
                await this.notifyMember(group, cycle, contribution);
            }
            await this.notifyAdmin(group, cycle, pendingContributions.length);
            return pendingContributions.length;
        }
        catch (err) {
            this.logger.error(`Failed to flag defaulters for cycle ${cycle._id.toString()}: ${String(err)}`);
            return 0;
        }
    }
    async notifyMember(group, cycle, contribution) {
        try {
            const user = await this.usersService.findById(contribution.user.toString());
            const phones = user
                ? new Map([[contribution.user.toString(), user.phone]])
                : undefined;
            await this.notificationsService.send(notification_events_1.NotificationEvents.contributionDefaulted({
                userIds: [contribution.user.toString()],
                groupName: group.name,
                amount: contribution.amount,
                dueDate: cycle.dueDate,
                data: {
                    groupId: group._id.toString(),
                    cycleId: cycle._id.toString(),
                },
                phones,
            }));
        }
        catch (err) {
            this.logger.error(`Failed to notify defaulting member: ${String(err)}`);
        }
    }
    async notifyAdmin(group, cycle, defaulterCount) {
        try {
            const adminMembership = await this.groupMemberModel.findOne({
                group: group._id,
                isGroupAdmin: true,
            });
            if (!adminMembership)
                return;
            await this.notificationsService.send(notification_events_1.NotificationEvents.adminDefaulterSummary({
                userIds: [adminMembership.user.toString()],
                groupName: group.name,
                defaulterCount,
                cycleNumber: cycle.cycleNumber,
                data: {
                    groupId: group._id.toString(),
                    cycleId: cycle._id.toString(),
                },
            }));
        }
        catch (err) {
            this.logger.error(`Failed to notify admin of defaulters: ${String(err)}`);
        }
    }
};
exports.DefaulterScheduler = DefaulterScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_10AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DefaulterScheduler.prototype, "flagDefaulters", null);
exports.DefaulterScheduler = DefaulterScheduler = DefaulterScheduler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(cycle_schema_1.Cycle.name)),
    __param(1, (0, mongoose_1.InjectModel)(contribution_schema_1.Contribution.name)),
    __param(2, (0, mongoose_1.InjectModel)(group_schema_1.Group.name)),
    __param(3, (0, mongoose_1.InjectModel)(group_member_schema_1.GroupMember.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        notifications_service_1.NotificationsService,
        users_service_1.UsersService])
], DefaulterScheduler);
//# sourceMappingURL=defaulter.scheduler.js.map