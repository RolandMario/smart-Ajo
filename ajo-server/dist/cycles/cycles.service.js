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
const escrow_service_1 = require("./escrow.service");
const platform_settings_service_1 = require("../platform-settings/platform-settings.service");
const group_enum_1 = require("../common/enums/group.enum");
const cycle_enum_1 = require("../common/enums/cycle.enum");
const wallet_enum_1 = require("../common/enums/wallet.enum");
const MEMBER_USER_FIELDS = 'name phone email';
const UNPAID_CONTRIBUTION_STATUSES = [
    cycle_enum_1.ContributionStatus.PENDING,
    cycle_enum_1.ContributionStatus.DEFAULTED,
    cycle_enum_1.ContributionStatus.AWAITING_CONFIRMATION,
];
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
    escrowService;
    notificationsService;
    platformSettings;
    logger = new common_1.Logger(CyclesService_1.name);
    constructor(cycleModel, contributionModel, groupMemberModel, groupWalletModel, groupWalletTxModel, payoutModel, connection, groupAccess, walletService, paystack, usersService, escrowService, notificationsService, platformSettings) {
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
        this.escrowService = escrowService;
        this.notificationsService = notificationsService;
        this.platformSettings = platformSettings;
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
    buildPaymentReference(group, position) {
        if (!group.joinCode || !position)
            return undefined;
        return `AJO-${group.joinCode.toUpperCase()}-${position}`;
    }
    async createCycleWithContributions(group, round, cycleNumber, recipientMember, dueDate, members, session) {
        const [cycle] = await this.cycleModel.create([
            {
                group: group._id,
                round,
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
            paymentReference: this.buildPaymentReference(group, m.position ?? undefined),
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
                await this.createCycleWithContributions(group, 1, 1, recipient, dueDate, members, session);
                group.status = group_enum_1.GroupStatus.ACTIVE;
                group.startDate = now;
                group.currentRound = 1;
                group.currentCycleNumber = 1;
                await group.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        await this.escrowService.getOrCreateGroupEscrowAccount(group);
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
            .sort({ round: 1, cycleNumber: 1 })
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
            round: group.currentRound ?? 1,
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
        await this.backfillPaymentReferences(group, contributions);
        return {
            cycle: populatedCycle,
            contributions,
            escrowAccount: this.escrowService.getStoredEscrowAccount(group),
            isAdmin: membership.isGroupAdmin,
            recipientPayoutReady: await this.recipientPayoutReady(populatedCycle),
        };
    }
    async recipientPayoutReady(cycle) {
        const recipientUserId = cycle.recipientMember?.user?._id;
        if (!recipientUserId)
            return false;
        try {
            const recipient = await this.usersService.findById(recipientUserId.toString());
            return Boolean(recipient?.bankAccount?.paystackRecipientCode);
        }
        catch {
            return false;
        }
    }
    async backfillPaymentReferences(group, contributions) {
        const missing = contributions.filter((c) => !c.paymentReference);
        if (missing.length === 0)
            return;
        try {
            const members = await this.groupMemberModel
                .find({
                group: group._id,
                _id: { $in: missing.map((c) => c.member) },
            })
                .select('position')
                .lean();
            const positionByMember = new Map(members.map((m) => [m._id.toString(), m.position ?? undefined]));
            await Promise.all(missing.map((contribution) => {
                const reference = this.buildPaymentReference(group, positionByMember.get(contribution.member.toString()));
                if (!reference)
                    return Promise.resolve();
                contribution.paymentReference = reference;
                return this.contributionModel
                    .updateOne({ _id: contribution._id }, { paymentReference: reference })
                    .exec();
            }));
        }
        catch (err) {
            this.logger.warn(`Failed to backfill payment references for group ${group._id.toString()}: ${String(err)}`);
        }
    }
    async payContributionFromWallet(userId, groupId, contributionId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertAcceptedMember(group._id, userId);
        const contribution = await this.getOwnContributionOrThrow(group, userId, contributionId);
        if (contribution.status === cycle_enum_1.ContributionStatus.PAID) {
            return this.getCurrentCycle(userId, groupId);
        }
        if (contribution.status === cycle_enum_1.ContributionStatus.AWAITING_CONFIRMATION) {
            throw new common_1.BadRequestException('This contribution is already awaiting the admin’s confirmation of your bank transfer.');
        }
        const cycle = await this.getOpenCycleForContribution(group, contribution);
        const serviceFee = await this.platformSettings.calculateEscrowTransferFee(contribution.amount);
        const totalDue = contribution.amount + serviceFee;
        const wallet = await this.walletService.getOrCreateWallet(userId);
        const balance = wallet.balance ?? 0;
        if (balance < totalDue) {
            throw new common_1.BadRequestException(`Insufficient wallet balance. You need ₦${totalDue.toLocaleString()} (contribution ₦${contribution.amount.toLocaleString()} + service fee ₦${serviceFee.toLocaleString()}) but have ₦${balance.toLocaleString()}. Please fund your wallet and try again.`);
        }
        const platformAdmin = await this.usersService.findPlatformAdmin();
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                const debited = await this.walletService.debitForContribution(contribution.user, contribution.amount, {
                    group: group._id,
                    cycle: cycle._id,
                    contribution: contribution._id,
                }, session, serviceFee);
                if (!debited) {
                    throw new common_1.BadRequestException('Your wallet balance is no longer sufficient. Please fund your wallet and try again.');
                }
                await this.creditGroupWallet(group._id, contribution.amount, { cycle: cycle._id, contribution: contribution._id }, session);
                if (serviceFee > 0) {
                    await this.walletService.creditServiceFee(platformAdmin._id.toString(), serviceFee, {
                        group: group._id,
                        cycle: cycle._id,
                        contribution: contribution._id,
                    }, session);
                }
                contribution.serviceFee = serviceFee;
                contribution.paymentMethod = cycle_enum_1.ContributionPaymentMethod.WALLET;
                contribution.status = cycle_enum_1.ContributionStatus.PAID;
                contribution.paidAt = new Date();
                await contribution.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        const updatedWallet = await this.walletService.getOrCreateWallet(userId);
        void this.notificationsService.send(notification_events_1.NotificationEvents.contributionPaid({
            userIds: [userId],
            groupName: group.name,
            amount: contribution.amount,
            newBalance: updatedWallet.balance ?? 0,
            serviceFee,
            data: { groupId, cycleId: cycle._id.toString() },
        }));
        return this.getCurrentCycle(userId, groupId);
    }
    async notifyBankTransferPayment(userId, groupId, contributionId, claimedReference) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertAcceptedMember(group._id, userId);
        const contribution = await this.getOwnContributionOrThrow(group, userId, contributionId);
        if (contribution.status === cycle_enum_1.ContributionStatus.PAID) {
            throw new common_1.BadRequestException('This contribution has already been paid.');
        }
        const cycle = await this.getOpenCycleForContribution(group, contribution);
        const serviceFee = await this.platformSettings.calculateEscrowTransferFee(contribution.amount);
        const adminMembership = await this.groupMemberModel.findOne({
            group: group._id,
            isGroupAdmin: true,
        });
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                if (serviceFee > 0) {
                    await this.walletService.debitServiceFee(contribution.user, serviceFee, {
                        group: group._id,
                        cycle: cycle._id,
                        contribution: contribution._id,
                    }, session);
                }
                contribution.paymentMethod = cycle_enum_1.ContributionPaymentMethod.BANK_TRANSFER;
                contribution.serviceFee = serviceFee;
                contribution.status = cycle_enum_1.ContributionStatus.AWAITING_CONFIRMATION;
                contribution.paymentNotifiedAt = new Date();
                contribution.claimedTransferReference =
                    claimedReference?.trim() || undefined;
                await contribution.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        if (adminMembership) {
            const memberUser = await this.usersService.findById(userId);
            void this.notificationsService.send(notification_events_1.NotificationEvents.contributionAwaitingConfirmation({
                userIds: [adminMembership.user.toString()],
                memberName: memberUser?.name ?? memberUser?.phone ?? 'A member',
                groupName: group.name,
                amount: contribution.amount,
                reference: contribution.claimedTransferReference ??
                    contribution.paymentReference,
                data: { groupId, cycleId: cycle._id.toString() },
            }));
        }
        return this.getCurrentCycle(userId, groupId);
    }
    async confirmContributionPaid(adminUserId, groupId, contributionId) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const contribution = await this.getContributionOrThrow(group, contributionId);
        if (contribution.status === cycle_enum_1.ContributionStatus.PAID) {
            return this.getCurrentCycle(adminUserId, groupId);
        }
        if (contribution.status !== cycle_enum_1.ContributionStatus.AWAITING_CONFIRMATION) {
            throw new common_1.BadRequestException('Only a contribution the member reported as paid by bank transfer can be confirmed.');
        }
        const cycle = await this.getOpenCycleForContribution(group, contribution);
        const serviceFee = contribution.serviceFee ?? 0;
        const deposit = await this.escrowService.findUnallocatedDepositForContribution({
            groupId: group._id,
            cycleId: cycle._id,
            contributionId: contribution._id,
            amount: contribution.amount,
        });
        const platformAdmin = await this.usersService.findPlatformAdmin();
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                if (deposit) {
                    await this.escrowService.allocateDeposit(deposit, {
                        cycle: cycle._id,
                        contribution: contribution._id,
                        adminUserId,
                    }, session);
                }
                else {
                    await this.creditGroupWallet(group._id, contribution.amount, { cycle: cycle._id, contribution: contribution._id }, session);
                }
                if (serviceFee > 0) {
                    await this.walletService.creditServiceFee(platformAdmin._id.toString(), serviceFee, {
                        group: group._id,
                        cycle: cycle._id,
                        contribution: contribution._id,
                    }, session);
                }
                contribution.status = cycle_enum_1.ContributionStatus.PAID;
                contribution.paymentMethod = cycle_enum_1.ContributionPaymentMethod.BANK_TRANSFER;
                contribution.serviceFee = serviceFee;
                contribution.paidAt = new Date();
                contribution.confirmedBy = new mongoose_2.Types.ObjectId(adminUserId);
                contribution.confirmedAt = new Date();
                await contribution.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        void this.notificationsService.send(notification_events_1.NotificationEvents.contributionConfirmed({
            userIds: [contribution.user.toString()],
            groupName: group.name,
            amount: contribution.amount,
            roundLabel: `cycle ${cycle.cycleNumber}`,
            data: { groupId, cycleId: cycle._id.toString() },
        }));
        return this.getCurrentCycle(adminUserId, groupId);
    }
    async rejectContributionPayment(adminUserId, groupId, contributionId, reason) {
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const contribution = await this.getContributionOrThrow(group, contributionId);
        if (contribution.status !== cycle_enum_1.ContributionStatus.AWAITING_CONFIRMATION) {
            throw new common_1.BadRequestException('Only a contribution awaiting confirmation can be rejected.');
        }
        const cycle = await this.getOpenCycleForContribution(group, contribution);
        const serviceFee = contribution.serviceFee ?? 0;
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                await this.escrowService.releaseDepositForContribution(group._id, contribution._id, session);
                if (serviceFee > 0) {
                    await this.walletService.refundServiceFee(contribution.user, serviceFee, {
                        group: group._id,
                        cycle: cycle._id,
                        contribution: contribution._id,
                    }, session);
                }
                contribution.status = cycle_enum_1.ContributionStatus.PENDING;
                contribution.paymentMethod = undefined;
                contribution.serviceFee = 0;
                contribution.lastRejectedAt = new Date();
                contribution.lastRejectionReason = reason;
                await contribution.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        void this.notificationsService.send(notification_events_1.NotificationEvents.contributionRejected({
            userIds: [contribution.user.toString()],
            groupName: group.name,
            amount: contribution.amount,
            reason,
            data: { groupId, cycleId: cycle._id.toString() },
        }));
        return this.getCurrentCycle(adminUserId, groupId);
    }
    async getContributionOrThrow(group, contributionId) {
        if (!mongoose_2.Types.ObjectId.isValid(contributionId)) {
            throw new common_1.BadRequestException('Invalid contribution id');
        }
        const contribution = await this.contributionModel.findOne({
            _id: contributionId,
            group: group._id,
        });
        if (!contribution)
            throw new common_1.NotFoundException('Contribution not found');
        return contribution;
    }
    async getOwnContributionOrThrow(group, userId, contributionId) {
        const contribution = await this.getContributionOrThrow(group, contributionId);
        if (contribution.user.toString() !== userId) {
            throw new common_1.ForbiddenException('This contribution does not belong to you');
        }
        return contribution;
    }
    async getOpenCycleForContribution(group, contribution) {
        const cycle = await this.cycleModel.findById(contribution.cycle);
        if (!cycle)
            throw new common_1.NotFoundException('Cycle not found');
        if (cycle.status !== cycle_enum_1.CycleStatus.OPEN) {
            throw new common_1.BadRequestException('This cycle is no longer open');
        }
        return cycle;
    }
    async initiatePayout(adminUserId, groupId, cycleId) {
        this.paystack.assertConfigured();
        const group = await this.groupAccess.getGroupOrThrow(groupId);
        await this.groupAccess.assertGroupAdmin(group._id, adminUserId);
        const cycle = await this.getCycleOrThrow(group, cycleId);
        if (cycle.status !== cycle_enum_1.CycleStatus.OPEN) {
            throw new common_1.BadRequestException('This cycle has already been paid out');
        }
        if (cycle.cycleNumber !== group.currentCycleNumber) {
            throw new common_1.BadRequestException("This is not the group's current active cycle");
        }
        const cycleContributions = await this.contributionModel
            .find({ cycle: cycle._id })
            .select('status amount')
            .lean();
        if (cycleContributions.length === 0) {
            throw new common_1.BadRequestException('Payout blocked: this cycle has no contributions to pay out');
        }
        const unpaid = cycleContributions.filter((contribution) => UNPAID_CONTRIBUTION_STATUSES.includes(contribution.status));
        if (unpaid.length > 0) {
            const awaitingConfirmation = unpaid.filter((c) => c.status === cycle_enum_1.ContributionStatus.AWAITING_CONFIRMATION).length;
            const stillUnpaid = unpaid.length - awaitingConfirmation;
            const parts = [
                stillUnpaid > 0 ? `${stillUnpaid} member(s) have not paid` : null,
                awaitingConfirmation > 0
                    ? `${awaitingConfirmation} payment(s) are awaiting your confirmation`
                    : null,
            ].filter(Boolean);
            throw new common_1.BadRequestException(`Payout blocked: ${parts.join(' and ')}. Confirm or reject the claimed bank transfers, and wait for the remaining members to pay.`);
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
        const payoutAmount = cycleContributions
            .filter((contribution) => contribution.status === cycle_enum_1.ContributionStatus.PAID)
            .reduce((sum, contribution) => sum + contribution.amount, 0);
        if (payoutAmount <= 0) {
            throw new common_1.BadRequestException('Payout blocked: this cycle has no confirmed contributions to pay out');
        }
        const payoutFee = await this.platformSettings.calculatePayoutFee(payoutAmount);
        const netAmount = payoutAmount - payoutFee;
        if (netAmount <= 0) {
            throw new common_1.BadRequestException(`Payout blocked: the ₦${payoutAmount.toLocaleString()} collected doesn't cover the ₦${payoutFee.toLocaleString()} platform payout fee.`);
        }
        const paystackReference = `payout_${cycleId}_${(0, crypto_1.randomUUID)()}`;
        let payout;
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                const existing = await this.payoutModel
                    .findOne({ cycle: cycle._id })
                    .session(session);
                if (existing) {
                    if (existing.status === wallet_enum_1.TransferStatus.SUCCESS) {
                        throw new common_1.BadRequestException('This cycle has already been paid out');
                    }
                    if (existing.status === wallet_enum_1.TransferStatus.PENDING) {
                        throw new common_1.BadRequestException('A payout for this cycle is already in progress. Wait for Paystack to confirm it before trying again.');
                    }
                    existing.recipientMember = recipientMember._id;
                    existing.recipientUser = recipientUser._id;
                    existing.initiatedBy = new mongoose_2.Types.ObjectId(adminUserId);
                    existing.amount = payoutAmount;
                    existing.fee = payoutFee;
                    existing.netAmount = netAmount;
                    existing.status = wallet_enum_1.TransferStatus.PENDING;
                    existing.paystackReference = paystackReference;
                    existing.paystackTransferCode = undefined;
                    existing.failureReason = undefined;
                    existing.completedAt = undefined;
                    await existing.save({ session });
                    payout = existing;
                }
                else {
                    const [payoutDoc] = await this.payoutModel.create([
                        {
                            group: group._id,
                            cycle: cycle._id,
                            recipientMember: recipientMember._id,
                            recipientUser: recipientUser._id,
                            initiatedBy: new mongoose_2.Types.ObjectId(adminUserId),
                            amount: payoutAmount,
                            fee: payoutFee,
                            netAmount,
                            status: wallet_enum_1.TransferStatus.PENDING,
                            paystackReference,
                        },
                    ], { session });
                    payout = payoutDoc;
                }
                await this.debitGroupWallet(group._id, payoutAmount, { cycle: cycle._id, payout: payout._id }, session);
            });
        }
        finally {
            await session.endSession();
        }
        let transfer;
        try {
            transfer = await this.paystack.initiateTransfer({
                amountNaira: netAmount,
                recipientCode: recipientUser.bankAccount.paystackRecipientCode,
                reason: `Ajo payout – ${group.name} cycle ${cycle.cycleNumber}`,
                reference: paystackReference,
            });
        }
        catch (err) {
            const reason = this.describePayoutFailure(err);
            this.logger.error(`Paystack transfer failed for payout ${payout._id.toString()}: ${reason}`);
            await this.handleFailedPayout(payout, group._id, cycle._id, reason);
            throw new common_1.BadRequestException(`Payout could not be sent: ${reason}. Your group wallet has been refunded — please try again.`);
        }
        payout.paystackTransferCode = transfer.transferCode;
        await payout.save();
        void this.notificationsService.send(notification_events_1.NotificationEvents.payoutInitiated({
            userIds: [recipientUser._id.toString()],
            groupName: group.name,
            amount: netAmount,
            bankName: recipientUser.bankAccount.bankName,
            accountNumber: recipientUser.bankAccount.accountNumber,
            data: {
                groupId: group._id.toString(),
                cycleId: cycle._id.toString(),
            },
        }));
        if (transfer.status === 'success') {
            await this.finalizeAcceptedPayout(payout, cycle, group);
        }
        else if (transfer.status === 'otp' && this.paystack.isTestMode()) {
            this.logger.log(`Test mode: resolving OTP for transfer ${transfer.transferCode}`);
            try {
                await this.paystack.resolveOtp(transfer.transferCode, this.paystack.testTransferOtp());
            }
            catch (err) {
                const reason = this.describePayoutFailure(err);
                this.logger.error(`Paystack transfer ${transfer.transferCode} could not be finalized ` +
                    `with the test OTP: ${reason}`);
                await this.handleFailedPayout(payout, group._id, cycle._id, reason);
                throw new common_1.BadRequestException(`Payout could not be sent: ${reason}. Your group wallet has been refunded — please try again.`);
            }
            await this.finalizeAcceptedPayout(payout, cycle, group);
        }
        return this.payoutModel.findById(payout._id).lean();
    }
    async finalizeAcceptedPayout(payout, cycle, group) {
        try {
            await this.finalizeSuccessfulPayout(payout, cycle, group);
        }
        catch (err) {
            this.logger.error(`Payout ${payout._id.toString()} was accepted by Paystack (transfer ` +
                `${payout.paystackTransferCode ?? 'unknown'}) but local finalization ` +
                `failed: ${this.describePayoutFailure(err)}. Keeping it PENDING — ` +
                'the webhook will finalize it. Do not refund automatically.');
        }
    }
    describePayoutFailure(err) {
        if (err instanceof common_1.HttpException) {
            const response = err.getResponse();
            if (typeof response === 'string')
                return response;
            if (response && typeof response === 'object') {
                const message = response.message;
                if (Array.isArray(message))
                    return message.join(' ');
                if (message)
                    return message;
            }
        }
        if (err instanceof Error && err.message)
            return err.message;
        return String(err);
    }
    async finalizeSuccessfulPayout(payout, cycle, group) {
        const payoutFee = payout.fee ?? 0;
        const platformAdmin = payoutFee > 0 ? await this.usersService.findPlatformAdmin() : null;
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
                if (platformAdmin && payoutFee > 0) {
                    await this.walletService.creditServiceFee(platformAdmin._id.toString(), payoutFee, { group: group._id, cycle: cycle._id }, session, {
                        reference: `payout_fee_${payout._id.toString()}`,
                        metadata: {
                            source: 'payout_fee',
                            payout: payout._id.toString(),
                            grossAmount: payout.amount,
                        },
                    });
                }
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
                    if (!nextRecipient) {
                        this.logger.warn(`Group ${group._id.toString()} has no member at rotation ` +
                            `position ${nextPosition} (totalSlots=${group.totalSlots}); ` +
                            'completing the group after the final payout.');
                        group.status = group_enum_1.GroupStatus.COMPLETED;
                        await group.save({ session });
                        return;
                    }
                    const members = await this.groupMemberModel
                        .find({ group: group._id, inviteStatus: group_enum_1.InviteStatus.ACCEPTED })
                        .session(session);
                    const nextDue = this.computeNextDueDate(cycle.dueDate, group.frequency);
                    await this.createCycleWithContributions(group, cycle.round, nextPosition, nextRecipient, nextDue, members, session);
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
            amount: payout.netAmount || payout.amount,
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
        const feeWasCredited = payout.status === wallet_enum_1.TransferStatus.SUCCESS && (payout.fee ?? 0) > 0;
        const platformAdmin = feeWasCredited
            ? await this.usersService.findPlatformAdmin()
            : null;
        const payoutFee = payout.fee ?? 0;
        const session = await this.connection.startSession();
        try {
            await session.withTransaction(async () => {
                payout.status = wallet_enum_1.TransferStatus.REVERSED;
                await payout.save({ session });
                await this.reverseGroupWalletDebit(group._id, payout.amount, { cycle: payout.cycle, payout: payout._id }, session);
                if (platformAdmin && feeWasCredited) {
                    await this.walletService.reverseServiceFeeCredit(platformAdmin._id.toString(), payoutFee, { group: group._id, cycle: payout.cycle }, session, {
                        reference: `payout_fee_reversal_${payout._id.toString()}`,
                        metadata: {
                            source: 'payout_fee_reversal',
                            payout: payout._id.toString(),
                        },
                    });
                }
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
                amount: payout.netAmount || payout.amount,
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
    __param(12, (0, common_1.Inject)((0, common_1.forwardRef)(() => notifications_service_1.NotificationsService))),
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
        escrow_service_1.EscrowService,
        notifications_service_1.NotificationsService,
        platform_settings_service_1.PlatformSettingsService])
], CyclesService);
//# sourceMappingURL=cycles.service.js.map