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
exports.PlatformAdminGroupsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const group_schema_1 = require("../groups/schemas/group.schema");
const group_member_schema_1 = require("../groups/schemas/group-member.schema");
const user_schema_1 = require("../users/schemas/user.schema");
const cycle_schema_1 = require("../cycles/schemas/cycle.schema");
const contribution_schema_1 = require("../cycles/schemas/contribution.schema");
const group_wallet_schema_1 = require("../cycles/schemas/group-wallet.schema");
const payout_schema_1 = require("../cycles/schemas/payout.schema");
const cycle_enum_1 = require("../common/enums/cycle.enum");
let PlatformAdminGroupsService = class PlatformAdminGroupsService {
    groupModel;
    groupMemberModel;
    userModel;
    cycleModel;
    contributionModel;
    groupWalletModel;
    payoutModel;
    constructor(groupModel, groupMemberModel, userModel, cycleModel, contributionModel, groupWalletModel, payoutModel) {
        this.groupModel = groupModel;
        this.groupMemberModel = groupMemberModel;
        this.userModel = userModel;
        this.cycleModel = cycleModel;
        this.contributionModel = contributionModel;
        this.groupWalletModel = groupWalletModel;
        this.payoutModel = payoutModel;
    }
    async listGroups(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const filter = {};
        if (query.status) {
            filter.status = query.status;
        }
        if (query.search) {
            const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = new RegExp(escaped, 'i');
        }
        const [groups, total] = await Promise.all([
            this.groupModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.groupModel.countDocuments(filter),
        ]);
        return {
            groups: groups.map((g) => ({
                id: g._id.toString(),
                name: g.name,
                status: g.status,
                contributionAmount: g.contributionAmount,
                frequency: g.frequency,
                totalSlots: g.totalSlots,
                rotationMethod: g.rotationMethod,
                autoCollectEnabled: g.autoCollectEnabled,
                currentCycleNumber: g.currentCycleNumber ?? null,
                createdAt: g.createdAt,
            })),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async getGroupDetail(groupId) {
        if (!mongoose_2.Types.ObjectId.isValid(groupId)) {
            throw new common_1.NotFoundException('Group not found');
        }
        const group = await this.groupModel.findById(groupId).lean();
        if (!group) {
            throw new common_1.NotFoundException('Group not found');
        }
        const [members, wallet, cycles, payouts] = await Promise.all([
            this.groupMemberModel
                .find({ group: group._id })
                .populate('user', 'name phone email')
                .sort({ position: 1, createdAt: 1 })
                .lean(),
            this.groupWalletModel.findOne({ group: group._id }).lean(),
            this.cycleModel
                .find({ group: group._id })
                .sort({ cycleNumber: 1 })
                .lean(),
            this.payoutModel
                .find({ group: group._id })
                .populate('recipientUser', 'name phone')
                .sort({ createdAt: -1 })
                .lean(),
        ]);
        const adminMembership = members.find((m) => m.isGroupAdmin);
        const adminUser = adminMembership?.user;
        const memberStandings = members.map((m) => {
            const user = m.user;
            return {
                groupMemberId: m._id.toString(),
                user: {
                    id: user._id.toString(),
                    name: user.name,
                    phone: user.phone,
                    email: user.email,
                },
                isGroupAdmin: m.isGroupAdmin,
                inviteStatus: m.inviteStatus,
                position: m.position,
                payoutStatus: m.payoutStatus,
                defaultCount: m.defaultCount,
            };
        });
        let cycleSummaries = [];
        if (cycles.length > 0) {
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
            cycleSummaries = cycles.map((cycle) => {
                const counts = countsByCycle.get(cycle._id.toString());
                return {
                    cycleId: cycle._id.toString(),
                    cycleNumber: cycle.cycleNumber,
                    status: cycle.status,
                    dueDate: cycle.dueDate,
                    contributionAmount: cycle.contributionAmount,
                    totalSlots: cycle.totalSlots,
                    paidCount: counts.paid,
                    defaultedCount: counts.defaulted,
                    pendingCount: counts.pending,
                    completedAt: cycle.completedAt,
                };
            });
        }
        const cycleNumberById = new Map(cycles.map((c) => [c._id.toString(), c.cycleNumber]));
        const payoutSummaries = payouts.map((p) => {
            const recipient = p.recipientUser;
            return {
                payoutId: p._id.toString(),
                cycleNumber: cycleNumberById.get(p.cycle.toString()) ?? 0,
                recipient: {
                    id: recipient._id.toString(),
                    name: recipient.name,
                    phone: recipient.phone,
                },
                amount: p.amount,
                status: p.status,
                failureReason: p.failureReason,
                completedAt: p.completedAt,
                createdAt: p.createdAt,
            };
        });
        return {
            id: group._id.toString(),
            name: group.name,
            status: group.status,
            contributionAmount: group.contributionAmount,
            frequency: group.frequency,
            totalSlots: group.totalSlots,
            rotationMethod: group.rotationMethod,
            autoCollectEnabled: group.autoCollectEnabled,
            currentCycleNumber: group.currentCycleNumber ?? null,
            orderLockedAt: group.orderLockedAt,
            startDate: group.startDate,
            centralWalletBalance: wallet?.balance ?? 0,
            admin: adminUser
                ? {
                    id: adminUser._id.toString(),
                    name: adminUser.name,
                    phone: adminUser.phone,
                }
                : undefined,
            members: memberStandings,
            cycles: cycleSummaries,
            payouts: payoutSummaries,
            createdAt: group.createdAt,
            updatedAt: group.updatedAt,
        };
    }
    async updateServiceFee(groupId, serviceFee) {
        if (!mongoose_2.Types.ObjectId.isValid(groupId)) {
            throw new common_1.NotFoundException('Group not found');
        }
        const group = await this.groupModel.findById(groupId);
        if (!group) {
            throw new common_1.NotFoundException('Group not found');
        }
        if (serviceFee !== undefined) {
            group.serviceFee = serviceFee;
            await group.save();
        }
        return this.getGroupDetail(groupId);
    }
};
exports.PlatformAdminGroupsService = PlatformAdminGroupsService;
exports.PlatformAdminGroupsService = PlatformAdminGroupsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(group_schema_1.Group.name)),
    __param(1, (0, mongoose_1.InjectModel)(group_member_schema_1.GroupMember.name)),
    __param(2, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(3, (0, mongoose_1.InjectModel)(cycle_schema_1.Cycle.name)),
    __param(4, (0, mongoose_1.InjectModel)(contribution_schema_1.Contribution.name)),
    __param(5, (0, mongoose_1.InjectModel)(group_wallet_schema_1.GroupWallet.name)),
    __param(6, (0, mongoose_1.InjectModel)(payout_schema_1.Payout.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], PlatformAdminGroupsService);
//# sourceMappingURL=platform-admin-groups.service.js.map