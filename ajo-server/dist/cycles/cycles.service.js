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
var CyclesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CyclesService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const cycle_schema_1 = require("./schemas/cycle.schema");
const contribution_schema_1 = require("./schemas/contribution.schema");
const group_wallet_schema_1 = require("./schemas/group-wallet.schema");
const group_wallet_transaction_schema_1 = require("./schemas/group-wallet-transaction.schema");
const payout_schema_1 = require("./schemas/payout.schema");
const group_member_schema_1 = require("../groups/schemas/group-member.schema");
const group_access_service_1 = require("../groups/group-access.service");
const wallet_service_1 = require("../wallet/wallet.service");
const paystack_service_1 = require("../payments/paystack.service");
const users_service_1 = require("../users/users.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_events_1 = require("../notifications/notification-events");
const group_enum_1 = require("../common/enums/group.enum");
const cycle_enum_1 = require("../common/enums/cycle.enum");
const wallet_enum_1 = require("../common/enums/wallet.enum");
const MEMBER_USER_FIELDS = 'name phone email';
let CyclesService = CyclesService_1 = class CyclesService {
    cycleModel;
    contributionModel;
    groupMemberModel;
    groupWalletModel;
    groupWalletTxModel;
    payoutModel;
    connection;
    groupAccess;
    walletService;
    paystack;
    usersService;
    notificationsService;
    logger = new common_1.Logger(CyclesService_1.name);
    constructor(cycleModel, contributionModel, groupMemberModel, groupWalletModel, groupWalletTxModel, payoutModel, connection, groupAccess, walletService, paystack, usersService, notificationsService) {
        this.cycleModel = cycleModel;
        this.contributionModel = contributionModel;
        this.groupMemberModel = groupMemberModel;
        this.groupWalletModel = groupWalletModel;
        this.groupWalletTxModel = groupWalletTxModel;
        this.payoutModel = payoutModel;
        this.connection = connection;
        this.groupAccess = groupAccess;
        this.walletService = walletService;
        this.paystack = paystack;
        this.usersService = usersService;
        this.notificationsService = notificationsService;
    }
    computeNextDueDate(from, frequency) {
        const next = new Date(from);
        switch (frequency) {
            case group_enum_1.ContributionFrequency.DAILY:
                next.setDate(next.getDate() + 1);
                break;
            case group_enum_1.ContributionFrequency.WEEKLY:
                next.setDate(next.getDate() + 7);
                break;
            case group_enum_1.ContributionFrequency.MONTHLY:
            default:
                next.setMonth(next.getMonth() + 1);
                break;
        }
        return next;
    }
    async createCycleWithContributions(group, cycleNumber, recipientMember, dueDate, members, session) {
        const [cycle] = await this.cycleModel.create([
            {
                group: group._id,
                cycleNumber,
                recipientMember: recipientMember._id,
                contributionAmount: group.contributionAmount,
                totalSlots: group.totalSlots,
                dueDate,
                status: cycle_enum_1.CycleStatus.OPEN,
            },
        ], { session });
        await this.contributionModel.insertMany(members.map((m) => ({
            group: group._id,
            cycle: cycle._id,
            member: m._id,
            user: m.user,
            amount: group.contributionAmount,
            status: cycle_enum_1.ContributionStatus.PENDING,
        })), { session });
        return cycle;
    }
    async creditGroupWallet(groupId, amount, refs, session) {
        let groupWallet = await this.groupWalletModel
            .findOne({ group: groupId })
            .session(session);
        if (!groupWallet) {
            [groupWallet] = await this.groupWalletModel.create([{ group: groupId, balance: 0 }], { session });
        }
        const balanceBefore = groupWallet.balance;
        const balanceAfter = balanceBefore + amount;
        groupWallet.balance = balanceAfter;
        await groupWallet.save({ session });
        await this.groupWalletTxModel.create([
            {
                groupWallet: groupWallet._id,
                group: groupId,
                type: wallet_enum_1.GroupWalletTransactionType.CONTRIBUTION_CREDIT,
                amount,
                balanceBefore,
                balanceAfter,
                cycle: refs.cycle,
                contribution: refs.contribution,
            },
        ], { session });
    }
    async debitGroupWallet(groupId, amount, refs, session) {
        const groupWallet = await this.groupWalletModel
            .findOne({ group: groupId })
            .session(session);
        if (!groupWallet || groupWallet.balance < amount) {
            throw new common_1.BadRequestException(`Insufficient group wallet balance (have ${groupWallet?.balance ?? 0}, need ${amount})`);
        }
        const balanceBefore = groupWallet.balance;
        const balanceAfter = balanceBefore - amount;
        groupWallet.balance = balanceAfter;
        await groupWallet.save({ session });
        await this.groupWalletTxModel.create([
            {
                groupWallet: groupWallet._id,
                group: groupId,
                type: wallet_enum_1.GroupWalletTransactionType.PAYOUT_DEBIT,
                amount,
                balanceBefore,
                balanceAfter,
                cycle: refs.cycle,
                payout: refs.payout,
            },
        ], { session });
    }
    async reverseGroupWalletDebit(groupId, amount, refs, session) {
        let groupWallet = await this.groupWalletModel
            .findOne({ group: groupId })
            .session(session);
        if (!groupWallet) {
            [groupWallet] = await this.groupWalletModel.create([{ group: groupId, balance: 0 }], { session });
        }
        const balanceBefore = groupWallet.balance;
        const balanceAfter = balanceBefore + amount;
        groupWallet.balance = balanceAfter;
        await groupWallet.save({ session });
        await this.groupWalletTxModel.create([
            {
                groupWallet: groupWallet._id,
                group: groupId,
                type: wallet_enum_1.GroupWalletTransactionType.PAYOUT_REVERSAL_CREDIT,
                amount,
                balanceBefore,
                balanceAfter,
                cycle: refs.cycle,
                payout: refs.payout,
            },
        ], { session });
    }
    async getCycleOrThrow(group, cycleId) {
        if (!mongoose_2.Types.ObjectId.isValid(cycleId))
            throw new common_1.BadRequestException('Invalid cycle id');
        const cycle = await this.cycleModel.findOne({
            _id: cycleId,
            group: group._id,
        });
        if (!cycle)
            throw new common_1.NotFoundException('Cycle not found');
        return cycle;
    }
    async populateCycle(cycleId) {
        const cycle = await this.cycleModel
            .findById(cycleId)
            .populate({
            path: 'recipientMember',
            populate: { path: 'user', select: MEMBER_USER_FIELDS },
        })
            .lean();
        if (!cycle)
            throw new common_1.NotFoundException('Cycle not found');
        return cycle;
    }
    async activateGroup(adminUserId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        if (group.status !== group_enum_1.GroupStatus.ORDER_LOCKED) {
            throw new common_1.BadRequestException('The group must have a locked rotation order before it can be activated');
        }
        const members = await this.groupMemberModel
            .find({ group: group._id, inviteStatus: group_enum_1.InviteStatus.ACCEPTED })
            .sort({ position: 1 });
        const recipient = members.find((m) => m.position === 1);
        if (!recipient)
            throw new common_1.BadRequestException('No member found at rotation position 1');
        await Promise.all(members.map((m) => this.walletService.getOrCreateWallet(m.user.toString())));
        const now = new Date();
        const dueDate = this.computeNextDueDate(now, group.frequency);
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                await this.groupWalletModel.create([{ group: group._id, balance: 0 }], {
                    session,
                });
                await this.createCycleWithContributions(group, 1, recipient, dueDate, members, session);
                group.status = group_enum_1.GroupStatus.ACTIVE;
                group.startDate = now;
                group.currentCycleNumber = 1;
                await group.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        void this.notificationsService.send(notification_events_1.NotificationEvents.groupActivated({
            userIds: members.map((m) => m.user.toString()),
            groupName: group.name,
            contributionAmount: group.contributionAmount,
            frequency: group.frequency,
            dueDate,
            data: { groupId: group._id.toString() },
        }));
        return this.getCurrentCycle(adminUserId, groupId);
    }
    async listCycles(userId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertAcceptedMember(group._id, userId);
        const cycles = await this.cycleModel
            .find({ group: group._id })
            .populate({
            path: 'recipientMember',
            populate: { path: 'user', select: MEMBER_USER_FIELDS },
        })
            .sort({ cycleNumber: 1 })
            .lean();
        if (cycles.length === 0)
            return [];
        const cycleIds = cycles.map((c) => c._id);
        const contributions = await this.contributionModel
            .find({ cycle: { $in: cycleIds } })
            .select('cycle status')
            .lean();
        const paidCountByCycle = new Map();
        for (const c of contributions) {
            if (c.status === cycle_enum_1.ContributionStatus.PAID) {
                const key = c.cycle.toString();
                paidCountByCycle.set(key, (paidCountByCycle.get(key) ?? 0) + 1);
            }
        }
        return cycles.map((c) => ({
            ...c,
            paidCount: paidCountByCycle.get(c._id.toString()) ?? 0,
        }));
    }
    async getCurrentCycle(userId, groupId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        const membership = await this.groupAccess.assertAcceptedMember(group._id, userId);
        if (!group.currentCycleNumber) {
            throw new common_1.BadRequestException('This group has not been activated yet');
        }
        const cycle = await this.cycleModel.findOne({
            group: group._id,
            cycleNumber: group.currentCycleNumber,
        });
        if (!cycle)
            throw new common_1.NotFoundException('Current cycle not found');
        const [populatedCycle, contributions] = await Promise.all([
            this.populateCycle(cycle._id),
            this.contributionModel
                .find({ cycle: cycle._id })
                .populate('user', MEMBER_USER_FIELDS)
                .lean(),
        ]);
        return {
            cycle: populatedCycle,
            contributions,
            isAdmin: membership.isGroupAdmin,
        };
    }
    async collectContributions(adminUserId, groupId, cycleId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const cycle = await this.getCycleOrThrow(group, cycleId);
        const results = await this.collectContributionsCore(group, cycle);
        const summary = await this.getCurrentCycle(adminUserId, groupId);
        return { results, ...summary };
    }
    async collectContributionsSystem(group, cycle) {
        return this.collectContributionsCore(group, cycle);
    }
    async collectContributionsCore(group, cycle) {
        if (cycle.status !== cycle_enum_1.CycleStatus.OPEN) {
            throw new common_1.BadRequestException('This cycle is no longer open');
        }
        const pendingContributions = await this.contributionModel.find({
            cycle: cycle._id,
            status: cycle_enum_1.ContributionStatus.PENDING,
        });
        const platformAdmin = await this.usersService.findPlatformAdmin();
        const platformAdminWallet = await this.walletService.getOrCreateWallet(platformAdmin._id.toString());
        const results = [];
        for (const contribution of pendingContributions) {
            const session = await this.connection.startSession();
            let debited = false;
            try {
                await session.withTransaction(async () => {
                    const serviceFee = group.serviceFee;
                    debited = await this.walletService.debitForContribution(contribution.user, contribution.amount, {
                        group: group._id,
                        cycle: cycle._id,
                        contribution: contribution._id,
                    }, session, serviceFee);
                    if (debited) {
                        await this.creditGroupWallet(group._id, contribution.amount, { cycle: cycle._id, contribution: contribution._id }, session);
                        if (serviceFee > 0) {
                            await this.walletService.creditServiceFee(platformAdmin._id.toString(), serviceFee, {
                                group: group._id,
                                cycle: cycle._id,
                                contribution: contribution._id,
                            }, session);
                        }
                        contribution.serviceFee = serviceFee;
                        contribution.status = cycle_enum_1.ContributionStatus.PAID;
                        contribution.paidAt = new Date();
                        await contribution.save({ session });
                    }
                    results.push({
                        userId: contribution.user.toString(),
                        success: debited,
                    });
                });
            }
            catch (err) {
                this.logger.error(`Failed to collect contribution ${contribution._id.toString()}: ${String(err)}`);
                results.push({ userId: contribution.user.toString(), success: false });
            }
            finally {
                await session.endSession();
            }
            try {
                const wallet = await this.walletService.getOrCreateWallet(contribution.user.toString());
                if (debited) {
                    void this.notificationsService.send(notification_events_1.NotificationEvents.contributionDebited({
                        userIds: [contribution.user.toString()],
                        groupName: group.name,
                        amount: contribution.amount,
                        newBalance: wallet.balance,
                        data: {
                            groupId: group._id.toString(),
                            cycleId: cycle._id.toString(),
                        },
                    }));
                }
                else {
                    const memberUser = await this.usersService.findById(contribution.user.toString());
                    const phones = memberUser
                        ? new Map([[contribution.user.toString(), memberUser.phone]])
                        : undefined;
                    void this.notificationsService.send(notification_events_1.NotificationEvents.contributionFailedInsufficient({
                        userIds: [contribution.user.toString()],
                        groupName: group.name,
                        amount: contribution.amount,
                        currentBalance: wallet.balance,
                        data: {
                            groupId: group._id.toString(),
                            cycleId: cycle._id.toString(),
                        },
                        phones,
                    }));
                }
            }
            catch (err) {
                this.logger.error(`Failed to send contribution notification: ${String(err)}`);
            }
        }
        return results;
    }
    async initiatePayout(adminUserId, groupId, cycleId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const cycle = await this.getCycleOrThrow(group, cycleId);
        if (cycle.status !== cycle_enum_1.CycleStatus.OPEN) {
            throw new common_1.BadRequestException('This cycle has already been paid out');
        }
        if (cycle.cycleNumber !== group.currentCycleNumber) {
            throw new common_1.BadRequestException("This is not the group's current active cycle");
        }
        const pendingCount = await this.contributionModel.countDocuments({
            cycle: cycle._id,
            status: cycle_enum_1.ContributionStatus.PENDING,
        });
        if (pendingCount > 0) {
            throw new common_1.BadRequestException(`${pendingCount} member(s) still have pending contributions. Run collect-contributions first.`);
        }
        const recipientMember = await this.groupMemberModel.findById(cycle.recipientMember);
        if (!recipientMember)
            throw new common_1.NotFoundException('Recipient member not found');
        const recipientUser = await this.usersService.findById(recipientMember.user.toString());
        if (!recipientUser)
            throw new common_1.NotFoundException('Recipient user not found');
        if (!recipientUser.bankAccount?.paystackRecipientCode) {
            throw new common_1.BadRequestException(`The cycle recipient (${recipientUser.name ?? recipientUser.phone}) has not set up a payout bank account. They must add one via POST /wallet/bank-account before payout can proceed.`);
        }
        const payoutAmount = group.contributionAmount * group.totalSlots;
        const paystackReference = `payout_${cycleId}_${(0, crypto_1.randomUUID)()}`;
        let payout;
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                const [payoutDoc] = await this.payoutModel.create([
                    {
                        group: group._id,
                        cycle: cycle._id,
                        recipientMember: recipientMember._id,
                        recipientUser: recipientUser._id,
                        initiatedBy: new mongoose_2.Types.ObjectId(adminUserId),
                        amount: payoutAmount,
                        status: wallet_enum_1.TransferStatus.PENDING,
                        paystackReference,
                    },
                ], { session });
                payout = payoutDoc;
                await this.debitGroupWallet(group._id, payoutAmount, { cycle: cycle._id, payout: payout._id }, session);
            });
        }
        finally {
            await session.endSession();
        }
        try {
            const transfer = await this.paystack.initiateTransfer({
                amountNaira: payoutAmount,
                recipientCode: recipientUser.bankAccount.paystackRecipientCode,
                reason: `Ajo payout – ${group.name} cycle ${cycle.cycleNumber}`,
                reference: paystackReference,
            });
            payout.paystackTransferCode = transfer.transferCode;
            void this.notificationsService.send(notification_events_1.NotificationEvents.payoutInitiated({
                userIds: [recipientUser._id.toString()],
                groupName: group.name,
                amount: payoutAmount,
                bankName: recipientUser.bankAccount.bankName,
                accountNumber: recipientUser.bankAccount.accountNumber,
                data: {
                    groupId: group._id.toString(),
                    cycleId: cycle._id.toString(),
                },
            }));
            if (transfer.status === 'success') {
                await this.finalizeSuccessfulPayout(payout, cycle, group);
            }
            else if (transfer.status === 'otp' && this.paystack.isTestMode()) {
                this.logger.log(`Test mode: resolving OTP for transfer ${transfer.transferCode}`);
                await this.paystack.resolveOtp(transfer.transferCode, this.paystack.testTransferOtp());
                await this.finalizeSuccessfulPayout(payout, cycle, group);
            }
            else {
                await payout.save();
            }
        }
        catch (err) {
            this.logger.error(`Paystack transfer failed for payout ${payout._id.toString()}: ${String(err)}`);
            await this.handleFailedPayout(payout, group._id, cycle._id, String(err));
        }
        return this.payoutModel.findById(payout._id).lean();
    }
    async finalizeSuccessfulPayout(payout, cycle, group) {
        const session = await this.connection.startSession();
        let nextCycleCreated = false;
        let nextCycleNumber;
        let nextDueDate;
        let allMemberUserIds = [];
        try {
            await session.withTransaction(async () => {
                payout.status = wallet_enum_1.TransferStatus.SUCCESS;
                payout.completedAt = new Date();
                await payout.save({ session });
                cycle.status = cycle_enum_1.CycleStatus.COMPLETED;
                cycle.completedAt = new Date();
                await cycle.save({ session });
                const recipientMember = await this.groupMemberModel
                    .findById(cycle.recipientMember)
                    .session(session);
                if (recipientMember) {
                    recipientMember.payoutStatus = group_enum_1.PayoutStatus.COLLECTED;
                    await recipientMember.save({ session });
                }
                const allMembers = await this.groupMemberModel
                    .find({ group: group._id, inviteStatus: group_enum_1.InviteStatus.ACCEPTED })
                    .session(session);
                for (const member of allMembers) {
                    if (member._id.toString() !== recipientMember?._id.toString()) {
                        member.payoutStatus = group_enum_1.PayoutStatus.PENDING;
                        await member.save({ session });
                    }
                }
                if (cycle.cycleNumber < group.totalSlots) {
                    const nextPosition = cycle.cycleNumber + 1;
                    const nextRecipient = await this.groupMemberModel
                        .findOne({ group: group._id, position: nextPosition })
                        .session(session);
                    if (!nextRecipient)
                        throw new common_1.BadRequestException(`No member at rotation position ${nextPosition}`);
                    const members = await this.groupMemberModel
                        .find({ group: group._id, inviteStatus: group_enum_1.InviteStatus.ACCEPTED })
                        .session(session);
                    const nextDue = this.computeNextDueDate(cycle.dueDate, group.frequency);
                    await this.createCycleWithContributions(group, nextPosition, nextRecipient, nextDue, members, session);
                    group.currentCycleNumber = nextPosition;
                    nextCycleCreated = true;
                    nextCycleNumber = nextPosition;
                    nextDueDate = nextDue;
                    allMemberUserIds = members.map((m) => m.user.toString());
                }
                else {
                    group.status = group_enum_1.GroupStatus.COMPLETED;
                }
                await group.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        void this.notificationsService.send(notification_events_1.NotificationEvents.payoutSuccess({
            userIds: [payout.recipientUser.toString()],
            groupName: group.name,
            amount: payout.amount,
            data: { groupId: group._id.toString(), cycleId: cycle._id.toString() },
        }));
        if (nextCycleCreated && nextCycleNumber && nextDueDate) {
            void this.notificationsService.send(notification_events_1.NotificationEvents.cycleAdvanced({
                userIds: allMemberUserIds,
                groupName: group.name,
                cycleNumber: nextCycleNumber,
                contributionAmount: group.contributionAmount,
                dueDate: nextDueDate,
                data: { groupId: group._id.toString() },
            }));
        }
    }
    async handleFailedPayout(payout, groupId, cycleId, reason) {
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                payout.status = wallet_enum_1.TransferStatus.FAILED;
                payout.failureReason = reason;
                await payout.save({ session });
                await this.reverseGroupWalletDebit(groupId, payout.amount, { cycle: cycleId, payout: payout._id }, session);
            });
        }
        finally {
            await session.endSession();
        }
        const group = await this.groupAccess
            .getGroupOrThrow(groupId.toString())
            .catch(() => null);
        const adminMembership = group
            ? await this.groupMemberModel.findOne({
                group: group._id,
                isGroupAdmin: true,
            })
            : null;
        if (group && adminMembership) {
            void this.notificationsService.send(notification_events_1.NotificationEvents.payoutFailed({
                userIds: [adminMembership.user.toString()],
                groupName: group.name,
                amount: payout.amount,
                reason,
                data: { groupId: groupId.toString(), cycleId: cycleId.toString() },
            }));
        }
    }
    async handleReversedPayout(payout, group) {
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                payout.status = wallet_enum_1.TransferStatus.REVERSED;
                await payout.save({ session });
                await this.reverseGroupWalletDebit(group._id, payout.amount, { cycle: payout.cycle, payout: payout._id }, session);
            });
        }
        finally {
            await session.endSession();
        }
        const adminMembership = await this.groupMemberModel.findOne({
            group: group._id,
            isGroupAdmin: true,
        });
        if (adminMembership) {
            void this.notificationsService.send(notification_events_1.NotificationEvents.payoutReversed({
                userIds: [adminMembership.user.toString()],
                groupName: group.name,
                amount: payout.amount,
                data: { groupId: group._id.toString() },
            }));
        }
    }
    async findPayoutByReference(reference) {
        return this.payoutModel.findOne({ paystackReference: reference });
    }
    async findGroupById(groupId) {
        return this.groupAccess
            .getGroupOrThrow(groupId.toString())
            .catch(() => null);
    }
    async findCycleById(cycleId) {
        return this.cycleModel.findById(cycleId);
    }
};
exports.CyclesService = CyclesService;
exports.CyclesService = CyclesService = CyclesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(cycle_schema_1.Cycle.name)),
    __param(1, (0, mongoose_1.InjectModel)(contribution_schema_1.Contribution.name)),
    __param(2, (0, mongoose_1.InjectModel)(group_member_schema_1.GroupMember.name)),
    __param(3, (0, mongoose_1.InjectModel)(group_wallet_schema_1.GroupWallet.name)),
    __param(4, (0, mongoose_1.InjectModel)(group_wallet_transaction_schema_1.GroupWalletTransaction.name)),
    __param(5, (0, mongoose_1.InjectModel)(payout_schema_1.Payout.name)),
    __param(6, (0, mongoose_1.InjectConnection)()),
    __param(11, (0, common_1.Inject)((0, common_1.forwardRef)(() => notifications_service_1.NotificationsService))),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Connection,
        group_access_service_1.GroupAccessService,
        wallet_service_1.WalletService,
        paystack_service_1.PaystackService,
        users_service_1.UsersService,
        notifications_service_1.NotificationsService])
], CyclesService);
//# sourceMappingURL=cycles.service.js.map