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
exports.PlatformAdminUsersService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_schema_1 = require("../users/schemas/user.schema");
const group_member_schema_1 = require("../groups/schemas/group-member.schema");
const group_schema_1 = require("../groups/schemas/group.schema");
const wallet_schema_1 = require("../wallet/schemas/wallet.schema");
const wallet_service_1 = require("../wallet/wallet.service");
let PlatformAdminUsersService = class PlatformAdminUsersService {
    userModel;
    groupMemberModel;
    groupModel;
    walletModel;
    walletService;
    constructor(userModel, groupMemberModel, groupModel, walletModel, walletService) {
        this.userModel = userModel;
        this.groupMemberModel = groupMemberModel;
        this.groupModel = groupModel;
        this.walletModel = walletModel;
        this.walletService = walletService;
    }
    async listUsers(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const filter = {};
        if (query.role) {
            filter.role = query.role;
        }
        if (query.search) {
            const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(escaped, 'i');
            filter.$or = [{ name: regex }, { phone: regex }, { email: regex }];
        }
        const [users, total] = await Promise.all([
            this.userModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.userModel.countDocuments(filter),
        ]);
        return {
            users: users.map((u) => ({
                id: u._id.toString(),
                phone: u.phone,
                email: u.email,
                name: u.name,
                role: u.role,
                isPhoneVerified: u.isPhoneVerified,
                isEmailVerified: u.isEmailVerified,
                isActive: u.isActive,
                hasBankAccount: !!u.bankAccount,
                createdAt: u.createdAt,
            })),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async getUserDetail(userId) {
        if (!mongoose_2.Types.ObjectId.isValid(userId)) {
            throw new common_1.NotFoundException('User not found');
        }
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const [wallet, memberships] = await Promise.all([
            this.walletModel.findOne({ user: user._id }).lean(),
            this.groupMemberModel.find({ user: user._id }).lean(),
        ]);
        const groupIds = memberships.map((m) => m.group);
        const groups = await this.groupModel
            .find({ _id: { $in: groupIds } })
            .lean();
        const groupsById = new Map(groups.map((g) => [g._id.toString(), g]));
        const groupSummaries = memberships.map((m) => {
            const group = groupsById.get(m.group.toString());
            return {
                groupId: m.group.toString(),
                groupName: group?.name ?? '(deleted group)',
                groupStatus: group?.status ?? 'unknown',
                isGroupAdmin: m.isGroupAdmin,
                inviteStatus: m.inviteStatus,
                position: m.position,
                payoutStatus: m.payoutStatus,
                defaultCount: m.defaultCount,
            };
        });
        return {
            id: user._id.toString(),
            phone: user.phone,
            email: user.email,
            name: user.name,
            role: user.role,
            isPhoneVerified: user.isPhoneVerified,
            isEmailVerified: user.isEmailVerified,
            isActive: user.isActive,
            bankAccount: user.bankAccount
                ? {
                    bankName: user.bankAccount.bankName,
                    accountNumber: `****${user.bankAccount.accountNumber.slice(-4)}`,
                    accountName: user.bankAccount.accountName,
                }
                : undefined,
            wallet: {
                balance: wallet?.balance ?? 0,
                currency: wallet?.currency ?? 'NGN',
            },
            groups: groupSummaries,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };
    }
    async creditWallet(userId, amountNaira, note) {
        if (!mongoose_2.Types.ObjectId.isValid(userId)) {
            throw new common_1.NotFoundException('User not found');
        }
        const user = await this.userModel.findById(userId).lean();
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return this.walletService.creditUserWallet(userId, amountNaira, note);
    }
};
exports.PlatformAdminUsersService = PlatformAdminUsersService;
exports.PlatformAdminUsersService = PlatformAdminUsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_schema_1.User.name)),
    __param(1, (0, mongoose_1.InjectModel)(group_member_schema_1.GroupMember.name)),
    __param(2, (0, mongoose_1.InjectModel)(group_schema_1.Group.name)),
    __param(3, (0, mongoose_1.InjectModel)(wallet_schema_1.Wallet.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        wallet_service_1.WalletService])
], PlatformAdminUsersService);
//# sourceMappingURL=platform-admin-users.service.js.map