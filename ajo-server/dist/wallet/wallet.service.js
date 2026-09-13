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
exports.WalletService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const wallet_schema_1 = require("./schemas/wallet.schema");
const wallet_transaction_schema_1 = require("./schemas/wallet-transaction.schema");
const wallet_enum_1 = require("../common/enums/wallet.enum");
const users_service_1 = require("../users/users.service");
const paystack_service_1 = require("../payments/paystack.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_events_1 = require("../notifications/notification-events");
let WalletService = class WalletService {
    walletModel;
    walletTxModel;
    connection;
    usersService;
    paystack;
    notificationsService;
    constructor(walletModel, walletTxModel, connection, usersService, paystack, notificationsService) {
        this.walletModel = walletModel;
        this.walletTxModel = walletTxModel;
        this.connection = connection;
        this.usersService = usersService;
        this.paystack = paystack;
        this.notificationsService = notificationsService;
    }
    async getOrCreateWallet(userId) {
        const userObjectId = new mongoose_2.Types.ObjectId(userId);
        let wallet = await this.walletModel.findOne({ user: userObjectId });
        if (!wallet) {
            wallet = await this.walletModel.create({
                user: userObjectId,
                balance: 0,
            });
        }
        return wallet;
    }
    async getWalletSummary(userId) {
        const wallet = await this.getOrCreateWallet(userId);
        const user = await this.usersService.findById(userId);
        const recentTransactions = await this.walletTxModel
            .find({ user: wallet.user })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();
        return {
            balance: wallet.balance ?? 0,
            currency: wallet.currency,
            recentTransactions,
            dedicatedAccount: user?.dedicatedAccount?.active
                ? {
                    paystackCustomerCode: user.dedicatedAccount.paystackCustomerCode,
                    accountNumber: user.dedicatedAccount.accountNumber,
                    accountName: user.dedicatedAccount.accountName,
                    bankName: user.dedicatedAccount.bankName,
                    provider: user.dedicatedAccount.provider,
                    currency: user.dedicatedAccount.currency,
                    active: true,
                }
                : null,
        };
    }
    async listTransactions(userId, page = 1, limit = 20) {
        const wallet = await this.getOrCreateWallet(userId);
        const filter = { user: wallet.user };
        const [transactions, total] = await Promise.all([
            this.walletTxModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            this.walletTxModel.countDocuments(filter),
        ]);
        return {
            transactions,
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async initializeFunding(userId, amountNaira) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (!user.email) {
            throw new common_1.BadRequestException('An email address is required to fund your wallet. Add one via PATCH /auth/me first.');
        }
        const wallet = await this.getOrCreateWallet(userId);
        const reference = `fund_${(0, crypto_1.randomUUID)()}`;
        const { authorizationUrl } = await this.paystack.initializeTransaction(user.email, amountNaira, reference);
        await this.walletTxModel.create({
            wallet: wallet._id,
            user: wallet.user,
            type: wallet_enum_1.WalletTransactionType.FUNDING,
            status: wallet_enum_1.WalletTransactionStatus.PENDING,
            amount: amountNaira,
            balanceBefore: wallet.balance,
            balanceAfter: wallet.balance,
            reference,
        });
        return { authorizationUrl, reference };
    }
    async verifyFunding(userId, reference) {
        const result = await this.paystack.verifyTransaction(reference);
        if (result.status === 'success') {
            await this.confirmFunding(reference, result.amount / 100, {
                source: 'manual_verify',
            });
        }
        else if (result.status === 'failed' || result.status === 'abandoned') {
            await this.failFunding(reference);
        }
        return this.getWalletSummary(userId);
    }
    async confirmFunding(reference, amountNaira, metadata) {
        const session = await this.connection.startSession();
        let processed = false;
        let notifyUserId;
        let notifyNewBalance;
        try {
            await session.withTransaction(async () => {
                const tx = await this.walletTxModel
                    .findOne({ reference })
                    .session(session);
                if (!tx || tx.status === wallet_enum_1.WalletTransactionStatus.SUCCESS) {
                    return;
                }
                const wallet = await this.walletModel
                    .findById(tx.wallet)
                    .session(session);
                if (!wallet) {
                    return;
                }
                const balanceBefore = wallet.balance ?? 0;
                const balanceAfter = balanceBefore + amountNaira;
                wallet.balance = balanceAfter;
                await wallet.save({ session });
                tx.status = wallet_enum_1.WalletTransactionStatus.SUCCESS;
                tx.amount = amountNaira;
                tx.balanceBefore = balanceBefore;
                tx.balanceAfter = balanceAfter;
                if (metadata) {
                    tx.metadata = metadata;
                }
                await tx.save({ session });
                processed = true;
                notifyUserId = tx.user.toString();
                notifyNewBalance = balanceAfter;
            });
        }
        finally {
            await session.endSession();
        }
        if (notifyUserId !== undefined && notifyNewBalance !== undefined) {
            void this.notificationsService.send(notification_events_1.NotificationEvents.walletFunded({
                userIds: [notifyUserId],
                amount: amountNaira,
                newBalance: notifyNewBalance,
            }));
        }
        return processed;
    }
    async failFunding(reference) {
        await this.walletTxModel.updateOne({ reference, status: wallet_enum_1.WalletTransactionStatus.PENDING }, { $set: { status: wallet_enum_1.WalletTransactionStatus.FAILED } });
    }
    async getOrCreateDedicatedAccount(userId) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (!user.phone) {
            throw new common_1.BadRequestException('A verified phone number is required before a dedicated account can be created');
        }
        const stored = user.dedicatedAccount;
        if (stored?.active && stored.accountNumber) {
            return stored;
        }
        const customerCode = stored?.paystackCustomerCode ?? (await this.createPaystackCustomer(user));
        if (customerCode !== stored?.paystackCustomerCode) {
            user.dedicatedAccount = {
                paystackCustomerCode: customerCode,
                provider: 'paystack',
                currency: 'NGN',
                active: false,
            };
            await user.save();
        }
        const { firstName, lastName } = this.splitName(user.name);
        let result;
        try {
            result = await this.paystack.createDedicatedAccount({
                customerCode,
                preferredBank: this.paystack.dvaPreferredBank(),
                phone: user.phone,
                firstName,
                lastName,
            });
        }
        catch (err) {
            const existing = await this.paystack.fetchDedicatedAccounts(customerCode);
            result = existing.find((dva) => dva.active) ?? existing[0];
            if (!result?.accountNumber) {
                throw err;
            }
        }
        const dedicatedAccount = {
            paystackCustomerCode: customerCode,
            paystackAccountId: result.accountId,
            accountNumber: result.accountNumber,
            accountName: result.accountName,
            bankName: result.bankName,
            provider: 'paystack',
            currency: result.currency || 'NGN',
            active: result.active,
        };
        user.dedicatedAccount = dedicatedAccount;
        await user.save();
        return dedicatedAccount;
    }
    async refreshDedicatedAccount(userId) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const stored = user.dedicatedAccount;
        if (stored?.active && stored.accountNumber) {
            stored.active = false;
            if (stored.paystackAccountId) {
                try {
                    await this.paystack.deactivateDedicatedAccount(stored.paystackAccountId);
                    stored.paystackAccountId = undefined;
                }
                catch {
                }
            }
            user.dedicatedAccount = stored;
            await user.save();
        }
        return this.getOrCreateDedicatedAccount(userId);
    }
    async creditDedicatedAccountFunding(params) {
        const user = await this.usersService.findByPhone(params.phone);
        if (!user) {
            return false;
        }
        const existing = await this.walletTxModel.findOne({
            reference: params.reference,
        });
        if (existing) {
            return false;
        }
        const wallet = await this.getOrCreateWallet(user._id.toString());
        const balanceBefore = wallet.balance ?? 0;
        const balanceAfter = balanceBefore + params.amountNaira;
        wallet.balance = balanceAfter;
        await wallet.save();
        await this.walletTxModel.create({
            wallet: wallet._id,
            user: wallet.user,
            type: wallet_enum_1.WalletTransactionType.FUNDING,
            status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
            amount: params.amountNaira,
            balanceBefore,
            balanceAfter,
            reference: params.reference,
            metadata: {
                source: 'dedicated_account',
                ...(params.paystackData ?? {}),
            },
        });
        void this.notificationsService.send(notification_events_1.NotificationEvents.walletFunded({
            userIds: [user._id.toString()],
            amount: params.amountNaira,
            newBalance: balanceAfter,
        }));
        return true;
    }
    splitName(name) {
        const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0)
            return {};
        return {
            firstName: parts[0],
            lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
        };
    }
    async createPaystackCustomer(user) {
        const { firstName, lastName } = this.splitName(user.name);
        const { customerCode } = await this.paystack.createCustomer({
            firstName,
            lastName,
            phone: user.phone,
            email: user.email,
        });
        return customerCode;
    }
    async listBanks() {
        return this.paystack.listBanks();
    }
    async setBankAccount(userId, dto) {
        const resolved = await this.paystack.resolveAccountNumber(dto.accountNumber, dto.bankCode);
        const recipient = await this.paystack.createTransferRecipient({
            accountNumber: resolved.accountNumber,
            bankCode: dto.bankCode,
            accountName: resolved.accountName,
        });
        const bankAccount = {
            bankCode: dto.bankCode,
            bankName: dto.bankName,
            accountNumber: resolved.accountNumber,
            accountName: resolved.accountName,
            paystackRecipientCode: recipient.recipientCode,
        };
        const user = await this.usersService.setBankAccount(userId, bankAccount);
        return user.bankAccount;
    }
    async getBankAccount(userId) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        return user.bankAccount ?? null;
    }
    async debitForContribution(userId, amountNaira, refs, session, serviceFee = 0) {
        const reference = `contrib_${refs.contribution.toString()}`;
        const successTx = await this.walletTxModel.findOne({
            reference,
            status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
        });
        if (successTx) {
            return true;
        }
        await this.walletTxModel.deleteOne({
            reference,
            status: { $ne: wallet_enum_1.WalletTransactionStatus.SUCCESS },
        });
        const wallet = await this.walletModel
            .findOne({ user: userId })
            .session(session);
        if (!wallet) {
            return false;
        }
        const balance = wallet.balance ?? 0;
        if (balance < amountNaira + serviceFee) {
            return false;
        }
        const balanceBefore = balance;
        const balanceAfter = balanceBefore - amountNaira - serviceFee;
        wallet.balance = balanceAfter;
        await wallet.save({ session });
        const transactions = [
            {
                wallet: wallet._id,
                user: userId,
                type: wallet_enum_1.WalletTransactionType.CONTRIBUTION_DEBIT,
                status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
                amount: amountNaira,
                balanceBefore,
                balanceAfter: balanceAfter + serviceFee,
                reference,
                group: refs.group,
                cycle: refs.cycle,
                contribution: refs.contribution,
            },
        ];
        if (serviceFee > 0) {
            transactions.push({
                wallet: wallet._id,
                user: userId,
                type: wallet_enum_1.WalletTransactionType.SERVICE_FEE_DEBIT,
                status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
                amount: serviceFee,
                balanceBefore: balanceAfter + serviceFee,
                balanceAfter,
                reference: `${reference}_fee`,
                group: refs.group,
                cycle: refs.cycle,
                contribution: refs.contribution,
            });
        }
        try {
            await this.walletTxModel.create(transactions, { session, ordered: true });
        }
        catch (err) {
            const code = err?.code ?? err?.err?.code;
            const message = String(err?.message ?? err);
            const isDuplicateKey = code === 11000 || code === '11000' || message.includes('E11000');
            if (isDuplicateKey) {
                return true;
            }
            throw err;
        }
        return true;
    }
    async debitForSavings(userId, amountNaira, refs, reference, session) {
        const successTx = await this.walletTxModel.findOne({
            reference,
            status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
        });
        if (successTx) {
            return true;
        }
        await this.walletTxModel.deleteOne({
            reference,
            status: { $ne: wallet_enum_1.WalletTransactionStatus.SUCCESS },
        });
        const wallet = await this.walletModel
            .findOne({ user: userId })
            .session(session);
        if (!wallet) {
            return false;
        }
        const balance = wallet.balance ?? 0;
        if (balance < amountNaira) {
            return false;
        }
        const balanceBefore = balance;
        const balanceAfter = balanceBefore - amountNaira;
        wallet.balance = balanceAfter;
        await wallet.save({ session });
        try {
            await this.walletTxModel.create([
                {
                    wallet: wallet._id,
                    user: userId,
                    type: wallet_enum_1.WalletTransactionType.SAVINGS_DEBIT,
                    status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
                    amount: amountNaira,
                    balanceBefore,
                    balanceAfter,
                    reference,
                    metadata: { savingPlan: refs.savingPlan.toString() },
                },
            ], { session, ordered: true });
        }
        catch (err) {
            const code = err?.code ?? err?.err?.code;
            const message = String(err?.message ?? err);
            const isDuplicateKey = code === 11000 || code === '11000' || message.includes('E11000');
            if (isDuplicateKey) {
                return true;
            }
            throw err;
        }
        return true;
    }
    async creditServiceFee(adminUserId, amount, refs, session) {
        const wallet = await this.walletModel
            .findOne({ user: new mongoose_2.Types.ObjectId(adminUserId) })
            .session(session);
        if (!wallet) {
            return;
        }
        const balanceBefore = wallet.balance ?? 0;
        const balanceAfter = balanceBefore + amount;
        wallet.balance = balanceAfter;
        await wallet.save({ session });
        const reference = `sf_${refs.contribution.toString()}`;
        await this.walletTxModel.create([
            {
                wallet: wallet._id,
                user: new mongoose_2.Types.ObjectId(adminUserId),
                type: wallet_enum_1.WalletTransactionType.SERVICE_FEE_CREDIT,
                status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
                amount,
                balanceBefore,
                balanceAfter,
                reference,
                group: refs.group,
                cycle: refs.cycle,
                contribution: refs.contribution,
            },
        ], { session });
    }
    async creditBillCommission(adminUserId, commissionAmount, refs, session) {
        const wallet = await this.walletModel
            .findOne({ user: new mongoose_2.Types.ObjectId(adminUserId) })
            .session(session);
        if (!wallet) {
            return;
        }
        const balanceBefore = wallet.balance ?? 0;
        const balanceAfter = balanceBefore + commissionAmount;
        wallet.balance = balanceAfter;
        await wallet.save({ session });
        const reference = `bill_comm_${refs.billReference}`;
        await this.walletTxModel.create([
            {
                wallet: wallet._id,
                user: new mongoose_2.Types.ObjectId(adminUserId),
                type: wallet_enum_1.WalletTransactionType.BILL_COMMISSION_CREDIT,
                status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
                amount: commissionAmount,
                balanceBefore,
                balanceAfter,
                reference,
                metadata: {
                    billReference: refs.billReference,
                    billType: refs.billType,
                    userPaid: refs.userPaid,
                    actualCost: refs.actualCost,
                },
            },
        ], { session });
    }
    async debitForBillPayment(userId, amountNaira, reference, metadata, session) {
        const wallet = await this.walletModel
            .findOne({ user: userId })
            .session(session);
        if (!wallet) {
            return null;
        }
        const balance = wallet.balance ?? 0;
        if (balance < amountNaira) {
            return null;
        }
        const balanceBefore = balance;
        const balanceAfter = balanceBefore - amountNaira;
        wallet.balance = balanceAfter;
        await wallet.save({ session });
        const walletTx = await this.walletTxModel.create([
            {
                wallet: wallet._id,
                user: userId,
                type: wallet_enum_1.WalletTransactionType.BILL_PAYMENT,
                status: wallet_enum_1.WalletTransactionStatus.PENDING,
                amount: amountNaira,
                balanceBefore,
                balanceAfter,
                reference,
                metadata,
            },
        ], { session });
        return walletTx[0];
    }
    async confirmBillPayment(reference, session) {
        await this.walletTxModel.updateOne({
            reference,
            status: wallet_enum_1.WalletTransactionStatus.PENDING,
            type: wallet_enum_1.WalletTransactionType.BILL_PAYMENT,
        }, { $set: { status: wallet_enum_1.WalletTransactionStatus.SUCCESS } }, session ? { session } : undefined);
    }
    async failBillPayment(reference, amountNaira, session) {
        const tx = await this.walletTxModel
            .findOne({ reference, status: wallet_enum_1.WalletTransactionStatus.PENDING })
            .session(session);
        if (!tx)
            return;
        const wallet = await this.walletModel.findById(tx.wallet).session(session);
        if (!wallet)
            return;
        const balanceBefore = wallet.balance ?? 0;
        const balanceAfter = balanceBefore + amountNaira;
        wallet.balance = balanceAfter;
        await wallet.save({ session });
        tx.status = wallet_enum_1.WalletTransactionStatus.FAILED;
        await tx.save({ session });
        const notifyUserId = tx.user.toString();
        const notifyNewBalance = balanceAfter;
        if (notifyUserId && notifyNewBalance !== undefined) {
            void this.notificationsService.send(notification_events_1.NotificationEvents.walletFunded({
                userIds: [notifyUserId],
                amount: amountNaira,
                newBalance: notifyNewBalance,
            }));
        }
    }
    async creditUserWallet(userId, amountNaira, note) {
        if (amountNaira <= 0) {
            throw new common_1.BadRequestException('Amount must be greater than zero');
        }
        const wallet = await this.getOrCreateWallet(userId);
        const balanceBefore = wallet.balance ?? 0;
        const balanceAfter = balanceBefore + amountNaira;
        wallet.balance = balanceAfter;
        await wallet.save();
        const reference = `admin_credit_${(0, crypto_1.randomUUID)()}`;
        await this.walletTxModel.create([
            {
                wallet: wallet._id,
                user: wallet.user,
                type: wallet_enum_1.WalletTransactionType.ADMIN_CREDIT,
                status: wallet_enum_1.WalletTransactionStatus.SUCCESS,
                amount: amountNaira,
                balanceBefore,
                balanceAfter,
                reference,
                metadata: { note: note?.trim() || 'Admin wallet credit' },
            },
        ]);
        return { balance: balanceAfter, currency: wallet.currency };
    }
};
exports.WalletService = WalletService;
exports.WalletService = WalletService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(wallet_schema_1.Wallet.name)),
    __param(1, (0, mongoose_1.InjectModel)(wallet_transaction_schema_1.WalletTransaction.name)),
    __param(2, (0, mongoose_1.InjectConnection)()),
    __param(5, (0, common_1.Inject)((0, common_1.forwardRef)(() => notifications_service_1.NotificationsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Connection,
        users_service_1.UsersService,
        paystack_service_1.PaystackService,
        notifications_service_1.NotificationsService])
], WalletService);
//# sourceMappingURL=wallet.service.js.map