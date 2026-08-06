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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroupDashboardService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const group_member_schema_1 = require("../groups/schemas/group-member.schema");
const cycle_schema_1 = require("../cycles/schemas/cycle.schema");
const contribution_schema_1 = require("../cycles/schemas/contribution.schema");
const group_access_service_1 = require("../groups/group-access.service");
const cycle_enum_1 = require("../common/enums/cycle.enum");
const MEMBER_USER_FIELDS = 'name phone email';
let GroupDashboardService = class GroupDashboardService {
    groupMemberModel;
    cycleModel;
    contributionModel;
    groupAccess;
    constructor(groupMemberModel, cycleModel, contributionModel, groupAccess) {
        this.groupMemberModel = groupMemberModel;
        this.cycleModel = cycleModel;
        this.contributionModel = contributionModel;
        this.groupAccess = groupAccess;
    }
    async listCurrentDefaulters(adminUserId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const defaultedContributions = await this.contributionModel
            .find({ group: group._id, status: cycle_enum_1.ContributionStatus.DEFAULTED })
            .populate('user', MEMBER_USER_FIELDS)
            .populate('cycle')
            .lean();
        const memberIds = defaultedContributions.map((c) => c.member);
        const members = await this.groupMemberModel
            .find({ _id: { $in: memberIds } })
            .select('defaultCount')
            .lean();
        const defaultCountByMember = new Map(members.map((m) => [m._id.toString(), m.defaultCount]));
        const entries = defaultedContributions.map((c) => {
            const cycle = c.cycle;
            const user = c.user;
            return {
                contributionId: c._id.toString(),
                cycleId: cycle._id.toString(),
                cycleNumber: cycle.cycleNumber,
                dueDate: cycle.dueDate,
                amount: c.amount,
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                },
                defaultCount: defaultCountByMember.get(c.member.toString()) ?? 0,
                flaggedAt: c.flaggedAt,
            };
        });
        return entries.sort((a, b) => b.defaultCount - a.defaultCount);
    }
    async getMemberStandings(adminUserId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const members = await this.groupMemberModel
            .find({ group: group._id })
            .populate('user', MEMBER_USER_FIELDS)
            .sort({ position: 1, createdAt: 1 })
            .lean();
        let currentContributionByMember = new Map();
        if (group.currentCycleNumber) {
            const currentCycle = await this.cycleModel.findOne({
                group: group._id,
                cycleNumber: group.currentCycleNumber,
            });
            if (currentCycle) {
                const contributions = await this.contributionModel
                    .find({ cycle: currentCycle._id })
                    .select('member status')
                    .lean();
                currentContributionByMember = new Map(contributions.map((c) => [c.member.toString(), c.status]));
            }
        }
        return members.map((m) => {
            const user = m.user;
            return {
                groupMemberId: m._id.toString(),
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                },
                position: m.position,
                isGroupAdmin: m.isGroupAdmin,
                payoutStatus: m.payoutStatus,
                defaultCount: m.defaultCount,
                currentCycleStatus: currentContributionByMember.get(m._id.toString()) ?? null,
            };
        });
    }
    async getContributionSummary(adminUserId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const cycles = await this.cycleModel
            .find({ group: group._id })
            .sort({ cycleNumber: 1 })
            .lean();
        if (cycles.length === 0)
            return [];
        const cycleIds = cycles.map((c) => c._id);
        const contributions = await this.contributionModel
            .find({ cycle: { $in: cycleIds } })
            .select('cycle status')
            .lean();
        const countsByCycle = new Map();
        for (const cycle of cycles) {
            countsByCycle.set(cycle._id.toString(), {
                paid: 0,
                pending: 0,
                defaulted: 0,
            });
        }
        for (const contribution of contributions) {
            const counts = countsByCycle.get(contribution.cycle.toString());
            if (!counts)
                continue;
            if (contribution.status === cycle_enum_1.ContributionStatus.PAID)
                counts.paid += 1;
            else if (contribution.status === cycle_enum_1.ContributionStatus.DEFAULTED)
                counts.defaulted += 1;
            else
                counts.pending += 1;
        }
        return cycles.map((cycle) => ({
            cycleId: cycle._id.toString(),
            cycleNumber: cycle.cycleNumber,
            status: cycle.status,
            dueDate: cycle.dueDate,
            ...countsByCycle.get(cycle._id.toString()),
        }));
    }
};
exports.GroupDashboardService = GroupDashboardService;
exports.GroupDashboardService = GroupDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(group_member_schema_1.GroupMember.name)),
    __param(1, (0, mongoose_1.InjectModel)(cycle_schema_1.Cycle.name)),
    __param(2, (0, mongoose_1.InjectModel)(contribution_schema_1.Contribution.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        group_access_service_1.GroupAccessService])
], GroupDashboardService);
//# sourceMappingURL=group-dashboard.service.js.map