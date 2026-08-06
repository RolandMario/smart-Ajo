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
var ReminderScheduler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderScheduler = void 0;
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
const cycle_enum_2 = require("../common/enums/cycle.enum");
const group_enum_1 = require("../common/enums/group.enum");
const users_service_1 = require("../users/users.service");
let ReminderScheduler = ReminderScheduler_1 = class ReminderScheduler {
    cycleModel;
    contributionModel;
    groupModel;
    groupMemberModel;
    notificationsService;
    usersService;
    logger = new common_1.Logger(ReminderScheduler_1.name);
    constructor(cycleModel, contributionModel, groupModel, groupMemberModel, notificationsService, usersService) {
        this.cycleModel = cycleModel;
        this.contributionModel = contributionModel;
        this.groupModel = groupModel;
        this.groupMemberModel = groupMemberModel;
        this.notificationsService = notificationsService;
        this.usersService = usersService;
    }
    async sendContributionReminders() {
        this.logger.log('Running contribution reminder job...');
        const now = new Date();
        const threeDaysFromNow = this.dayRange(now, 3);
        const oneDayFromNow = this.dayRange(now, 1);
        const today = this.dayRange(now, 0);
        const [gentleCycles, urgentCycles] = await Promise.all([
            this.findCyclesWithDueDate(threeDaysFromNow.start, threeDaysFromNow.end),
            this.findCyclesWithDueDate(Math.min(oneDayFromNow.start, today.start), Math.max(oneDayFromNow.end, today.end)),
        ]);
        await Promise.all([
            ...gentleCycles.map((c) => this.sendReminder(c, 3)),
            ...urgentCycles.map((c) => this.sendReminder(c, c.dueDate <= now ? 0 : 1)),
        ]);
        this.logger.log(`Reminder job done. Gentle: ${gentleCycles.length} cycle(s), Urgent: ${urgentCycles.length} cycle(s).`);
    }
    dayRange(base, daysAhead) {
        const d = new Date(base);
        d.setDate(d.getDate() + daysAhead);
        d.setHours(0, 0, 0, 0);
        const start = d.getTime();
        d.setHours(23, 59, 59, 999);
        const end = d.getTime();
        return { start, end };
    }
    async findCyclesWithDueDate(startMs, endMs) {
        return this.cycleModel.find({
            status: cycle_enum_1.CycleStatus.OPEN,
            dueDate: { $gte: new Date(startMs), $lte: new Date(endMs) },
        });
    }
    async sendReminder(cycle, daysLeft) {
        try {
            const [group, pendingContributions] = await Promise.all([
                this.groupModel.findById(cycle.group),
                this.contributionModel.find({
                    cycle: cycle._id,
                    status: cycle_enum_2.ContributionStatus.PENDING,
                }),
            ]);
            if (!group || group.status !== group_enum_1.GroupStatus.ACTIVE)
                return;
            if (pendingContributions.length === 0)
                return;
            const userIds = pendingContributions.map((c) => c.user.toString());
            const phones = new Map();
            if (daysLeft <= 1) {
                await Promise.all(userIds.map(async (uid) => {
                    const user = await this.usersService.findById(uid);
                    if (user?.phone)
                        phones.set(uid, user.phone);
                }));
            }
            const payload = daysLeft <= 1
                ? notification_events_1.NotificationEvents.contributionDueUrgent({
                    userIds,
                    groupName: group.name,
                    amount: cycle.contributionAmount,
                    dueDate: cycle.dueDate,
                    data: {
                        groupId: group._id.toString(),
                        cycleId: cycle._id.toString(),
                    },
                    phones,
                })
                : notification_events_1.NotificationEvents.contributionDueReminder({
                    userIds,
                    groupName: group.name,
                    amount: cycle.contributionAmount,
                    daysLeft,
                    dueDate: cycle.dueDate,
                    data: {
                        groupId: group._id.toString(),
                        cycleId: cycle._id.toString(),
                    },
                });
            await this.notificationsService.send(payload);
        }
        catch (err) {
            this.logger.error(`Failed to send reminder for cycle ${cycle._id.toString()}: ${String(err)}`);
        }
    }
};
exports.ReminderScheduler = ReminderScheduler;
__decorate([
    (0, schedule_1.Cron)(schedule_1.CronExpression.EVERY_DAY_AT_9AM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReminderScheduler.prototype, "sendContributionReminders", null);
exports.ReminderScheduler = ReminderScheduler = ReminderScheduler_1 = __decorate([
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
], ReminderScheduler);
//# sourceMappingURL=reminder.scheduler.js.map