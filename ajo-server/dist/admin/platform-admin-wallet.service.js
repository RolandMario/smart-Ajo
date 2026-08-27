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
exports.PlatformAdminWalletService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const wallet_service_1 = require("../wallet/wallet.service");
const users_service_1 = require("../users/users.service");
const paystack_service_1 = require("../payments/paystack.service");
const wallet_transaction_schema_1 = require("../wallet/schemas/wallet-transaction.schema");
const wallet_enum_1 = require("../common/enums/wallet.enum");
const crypto_1 = require("crypto");
let PlatformAdminWalletService = class PlatformAdminWalletService {
    walletTxModel;
    connection;
    walletService;
    usersService;
    paystack;
    constructor(walletTxModel, connection, walletService, usersService, paystack) {
        this.walletTxModel = walletTxModel;
        this.connection = connection;
        this.walletService = walletService;
        this.usersService = usersService;
        this.paystack = paystack;
    }
    async getAdminWallet() {
        const admin = await this.usersService.findPlatformAdmin();
        const wallet = await this.walletService.getOrCreateWallet(admin._id.toString());
        const recentServiceFeeCredits = await this.walletTxModel
            .find({
            user: admin._id,
            type: wallet_enum_1.WalletTransactionType.SERVICE_FEE_CREDIT,
            status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
        })
            .populate('group', 'name')
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        const recentBillCommissionCredits = await this.walletTxModel
            .find({
            user: admin._id,
            type: wallet_enum_1.WalletTransactionType.BILL_COMMISSION_CREDIT,
            status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
        })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        const totalCommissionResult = await this.walletTxModel.aggregate([
            {
                $match: {
                    user: admin._id,
                    type: wallet_enum_1.WalletTransactionType.BILL_COMMISSION_CREDIT,
                    status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
                },
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                },
            },
        ]);
        const totalCommissionBalance = totalCommissionResult.length > 0 ? totalCommissionResult[0].total : 0;
        return {
            balance: wallet.balance ?? 0,
            currency: wallet.currency,
            bankAccount: admin.bankAccount ?? null,
            totalCommissionBalance,
            recentServiceFeeCredits: recentServiceFeeCredits.map((tx) => {
                const group = tx.group;
                return {
                    id: tx._id.toString(),
                    amount: tx.amount,
                    balanceAfter: tx.balanceAfter,
                    group: group
                        ? { id: group._id.toString(), name: group.name }
                        : undefined,
                    createdAt: tx.createdAt,
                };
            }),
            recentBillCommissionCredits: recentBillCommissionCredits.map((tx) => {
                const metadata = (tx.metadata ?? {});
                return {
                    id: tx._id.toString(),
                    amount: tx.amount,
                    balanceAfter: tx.balanceAfter,
                    billType: metadata.billType ?? 'unknown',
                    userPaid: metadata.userPaid ?? 0,
                    actualCost: metadata.actualCost ?? 0,
                    createdAt: tx.createdAt,
                };
            }),
        };
    }
    async withdraw(adminUserId, amountNaira) {
        const admin = await this.usersService.findById(adminUserId);
        if (!admin) {
            throw new common_1.NotFoundException('Admin not found');
        }
        if (!admin.bankAccount?.paystackRecipientCode) {
            throw new common_1.BadRequestException('You must set a bank account before withdrawing. Use POST /admin/wallet/bank-account first.');
        }
        const wallet = await this.walletService.getOrCreateWallet(adminUserId);
        if ((wallet.balance ?? 0) < amountNaira) {
            throw new common_1.BadRequestException(`Insufficient balance. You have ${wallet.balance ?? 0} but trying to withdraw ${amountNaira}.`);
        }
        const reference = `admin_withdraw_${(0, crypto_1.randomUUID)()}`;
        const session = await this.connection.startSession();
        let debited = false;
        try {
            await session.withTransaction(async () => {
                const balanceBefore = wallet.balance ?? 0;
                const balanceAfter = balanceBefore - amountNaira;
                wallet.balance = balanceAfter;
                await wallet.save({ session });
                await this.walletTxModel.create([
                    {
                        wallet: wallet._id,
                        user: admin._id,
                        type: wallet_enum_1.WalletTransactionType.ADMIN_WITHDRAWAL,
                        status: wallet_enum_1.WalletTransactionStatus.PENDING,
                        amount: amountNaira,
                        balanceBefore,
                        balanceAfter,
                        reference,
                        metadata: { source: 'admin_withdrawal' },
                    },
                ], { session });
                debited = true;
            });
        }
        finally {
            await session.endSession();
        }
        if (!debited) {
            throw new common_1.BadRequestException('Could not debit the wallet');
        }
        try {
            const transfer = await this.paystack.initiateTransfer({
                amountNaira,
                recipientCode: admin.bankAccount.paystackRecipientCode,
                reason: 'Ajo admin wallet withdrawal',
                reference,
            });
            await this.walletTxModel.updateOne({ reference, status: wallet_enum_1.WalletTransactionStatus.PENDING }, { $set: { status: wallet_enum_1.WalletTransactionStatus.SUCCESS } });
            return {
                message: 'Withdrawal initiated successfully',
                amount: amountNaira,
                transferCode: transfer.transferCode,
                status: transfer.status,
            };
        }
        catch (err) {
            const refundSession = await this.connection.startSession();
            try {
                await refundSession.withTransaction(async () => {
                    const w = await this.walletService.getOrCreateWallet(adminUserId);
                    w.balance = (w.balance ?? 0) + amountNaira;
                    await w.save({ session: refundSession });
                    await this.walletTxModel.updateOne({ reference, status: wallet_enum_1.WalletTransactionStatus.PENDING }, {
                        $set: {
                            status: wallet_enum_1.WalletTransactionStatus.FAILED,
                            metadata: { error: String(err), refunded: true },
                        },
                    }, { session: refundSession });
                });
            }
            finally {
                await refundSession.endSession();
            }
            throw new common_1.BadRequestException(`Withdrawal failed: the transfer could not be initiated. Your wallet has been refunded.`);
        }
    }
    async getBankAccount(adminUserId) {
        return this.walletService.getBankAccount(adminUserId);
    }
    async setBankAccount(adminUserId, dto) {
        return this.walletService.setBankAccount(adminUserId, dto);
    }
    async listBanks() {
        return this.walletService.listBanks();
    }
};
exports.PlatformAdminWalletService = PlatformAdminWalletService;
exports.PlatformAdminWalletService = PlatformAdminWalletService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(wallet_transaction_schema_1.WalletTransaction.name)),
    __param(1, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Connection,
        wallet_service_1.WalletService,
        users_service_1.UsersService,
        paystack_service_1.PaystackService])
], PlatformAdminWalletService);
//# sourceMappingURL=platform-admin-wallet.service.js.map