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
exports.PlatformAdminFinanceService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const wallet_transaction_schema_1 = require("../wallet/schemas/wallet-transaction.schema");
const payout_schema_1 = require("../cycles/schemas/payout.schema");
const group_wallet_transaction_schema_1 = require("../cycles/schemas/group-wallet-transaction.schema");
const cycle_schema_1 = require("../cycles/schemas/cycle.schema");
const wallet_enum_1 = require("../common/enums/wallet.enum");
let PlatformAdminFinanceService = class PlatformAdminFinanceService {
    walletTxModel;
    payoutModel;
    groupWalletTxModel;
    cycleModel;
    constructor(walletTxModel, payoutModel, groupWalletTxModel, cycleModel) {
        this.walletTxModel = walletTxModel;
        this.payoutModel = payoutModel;
        this.groupWalletTxModel = groupWalletTxModel;
        this.cycleModel = cycleModel;
    }
    async listWalletTransactions(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const filter = {
            type: query.type ?? wallet_enum_1.WalletTransactionType.FUNDING,
        };
        if (query.status)
            filter.status = query.status;
        if (query.userId)
            filter.user = new mongoose_2.Types.ObjectId(query.userId);
        const [transactions, total] = await Promise.all([
            this.walletTxModel
                .find(filter)
                .populate('user', 'name phone')
                .populate('group', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.walletTxModel.countDocuments(filter),
        ]);
        return {
            transactions: transactions.map((tx) => {
                const user = tx.user;
                const group = tx.group;
                return {
                    id: tx._id.toString(),
                    user: { id: user._id.toString(), name: user.name, phone: user.phone },
                    type: tx.type,
                    status: tx.status,
                    amount: tx.amount,
                    balanceBefore: tx.balanceBefore,
                    balanceAfter: tx.balanceAfter,
                    reference: tx.reference,
                    group: group
                        ? { id: group._id.toString(), name: group.name }
                        : undefined,
                    createdAt: tx.createdAt,
                };
            }),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async listPayouts(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const filter = {};
        if (query.status)
            filter.status = query.status;
        if (query.groupId)
            filter.group = new mongoose_2.Types.ObjectId(query.groupId);
        const [payouts, total] = await Promise.all([
            this.payoutModel
                .find(filter)
                .populate('group', 'name')
                .populate('recipientUser', 'name phone')
                .populate('initiatedBy', 'name phone')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.payoutModel.countDocuments(filter),
        ]);
        const cycleIds = payouts.map((p) => p.cycle);
        const cycles = await this.cycleModel
            .find({ _id: { $in: cycleIds } })
            .select('cycleNumber')
            .lean();
        const cycleNumberById = new Map(cycles.map((c) => [c._id.toString(), c.cycleNumber]));
        return {
            payouts: payouts.map((p) => {
                const group = p.group;
                const recipient = p.recipientUser;
                const initiator = p.initiatedBy;
                return {
                    id: p._id.toString(),
                    group: { id: group._id.toString(), name: group.name },
                    cycleNumber: cycleNumberById.get(p.cycle.toString()) ?? 0,
                    recipient: {
                        id: recipient._id.toString(),
                        name: recipient.name,
                        phone: recipient.phone,
                    },
                    initiatedBy: {
                        id: initiator._id.toString(),
                        name: initiator.name,
                        phone: initiator.phone,
                    },
                    amount: p.amount,
                    status: p.status,
                    failureReason: p.failureReason,
                    paystackReference: p.paystackReference,
                    completedAt: p.completedAt,
                    createdAt: p.createdAt,
                };
            }),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async listGroupWalletTransactions(query) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const filter = {};
        if (query.type)
            filter.type = query.type;
        if (query.groupId)
            filter.group = new mongoose_2.Types.ObjectId(query.groupId);
        const [transactions, total] = await Promise.all([
            this.groupWalletTxModel
                .find(filter)
                .populate('group', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.groupWalletTxModel.countDocuments(filter),
        ]);
        return {
            transactions: transactions.map((tx) => {
                const group = tx.group;
                return {
                    id: tx._id.toString(),
                    group: { id: group._id.toString(), name: group.name },
                    type: tx.type,
                    amount: tx.amount,
                    balanceBefore: tx.balanceBefore,
                    balanceAfter: tx.balanceAfter,
                    createdAt: tx.createdAt,
                };
            }),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
};
exports.PlatformAdminFinanceService = PlatformAdminFinanceService;
exports.PlatformAdminFinanceService = PlatformAdminFinanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(wallet_transaction_schema_1.WalletTransaction.name)),
    __param(1, (0, mongoose_1.InjectModel)(payout_schema_1.Payout.name)),
    __param(2, (0, mongoose_1.InjectModel)(group_wallet_transaction_schema_1.GroupWalletTransaction.name)),
    __param(3, (0, mongoose_1.InjectModel)(cycle_schema_1.Cycle.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], PlatformAdminFinanceService);
//# sourceMappingURL=platform-admin-finance.service.js.map