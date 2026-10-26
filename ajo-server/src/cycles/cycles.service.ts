import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { Cycle, CycleDocument } from './schemas/cycle.schema';
import {
  Contribution,
  ContributionDocument,
} from './schemas/contribution.schema';
import {
  GroupWallet,
  GroupWalletDocument,
} from './schemas/group-wallet.schema';
import {
  GroupWalletTransaction,
  GroupWalletTransactionDocument,
} from './schemas/group-wallet-transaction.schema';
import { Payout, PayoutDocument } from './schemas/payout.schema';
import { GroupDocument } from '../groups/schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../groups/schemas/group-member.schema';
import { GroupAccessService } from '../groups/group-access.service';
import { WalletService } from '../wallet/wallet.service';
import { PaystackService } from '../payments/paystack.service';
import type { InitiateTransferResult } from '../payments/paystack.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';
import { EscrowService } from './escrow.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import {
  ContributionFrequency,
  GroupStatus,
  InviteStatus,
  PayoutStatus,
} from '../common/enums/group.enum';
import {
  ContributionStatus,
  ContributionPaymentMethod,
  CycleStatus,
} from '../common/enums/cycle.enum';
import {
  GroupWalletTransactionType,
  TransferStatus,
} from '../common/enums/wallet.enum';
import {
  PopulatedContribution,
  PopulatedCycle,
} from './interfaces/populated-cycle.interface';

const MEMBER_USER_FIELDS = 'name phone email';

/** Contribution states that still block a cycle payout. */
const UNPAID_CONTRIBUTION_STATUSES: ContributionStatus[] = [
  ContributionStatus.PENDING,
  ContributionStatus.DEFAULTED,
  ContributionStatus.AWAITING_CONFIRMATION,
];

@Injectable()
export class CyclesService {
  private readonly logger = new Logger(CyclesService.name);

  constructor(
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(Contribution.name)
    private contributionModel: Model<ContributionDocument>,
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(GroupWallet.name)
    private groupWalletModel: Model<GroupWalletDocument>,
    @InjectModel(GroupWalletTransaction.name)
    private groupWalletTxModel: Model<GroupWalletTransactionDocument>,
    @InjectModel(Payout.name) private payoutModel: Model<PayoutDocument>,
    @InjectConnection() private connection: Connection,
    private groupAccess: GroupAccessService,
    private walletService: WalletService,
    private paystack: PaystackService,
    private usersService: UsersService,
    private escrowService: EscrowService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private platformSettings: PlatformSettingsService,
  ) {}

  // ---- Private helpers -------------------------------------------------------

  private computeNextDueDate(
    from: Date,
    frequency: ContributionFrequency,
  ): Date {
    const next = new Date(from);
    switch (frequency) {
      case ContributionFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case ContributionFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case ContributionFrequency.MONTHLY:
      default:
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  /**
   * The reference members are asked to put on a bank transfer into the
   * group's escrow account, e.g. `AJO-3F9K2A-2` (group join code + the
   * member's rotation position). Unique within a group, which is all the
   * narration matcher needs.
   */
  private buildPaymentReference(
    group: GroupDocument,
    position?: number,
  ): string | undefined {
    if (!group.joinCode || !position) return undefined;
    return `AJO-${group.joinCode.toUpperCase()}-${position}`;
  }

  private async createCycleWithContributions(
    group: GroupDocument,
    round: number,
    cycleNumber: number,
    recipientMember: GroupMemberDocument,
    dueDate: Date,
    members: GroupMemberDocument[],
    session: ClientSession,
  ): Promise<CycleDocument> {
    const [cycle] = await this.cycleModel.create(
      [
        {
          group: group._id,
          round,
          cycleNumber,
          recipientMember: recipientMember._id,
          contributionAmount: group.contributionAmount,
          totalSlots: group.totalSlots,
          dueDate,
          status: CycleStatus.OPEN,
        },
      ],
      { session },
    );

    await this.contributionModel.insertMany(
      members.map((m) => ({
        group: group._id,
        cycle: cycle._id,
        member: m._id,
        user: m.user,
        amount: group.contributionAmount,
        status: ContributionStatus.PENDING,
        paymentReference: this.buildPaymentReference(
          group,
          m.position ?? undefined,
        ),
      })),
      { session },
    );

    return cycle;
  }

  /**
   * Credits the group's central account (GroupWallet) by `amount`,
   * recording a CONTRIBUTION_CREDIT ledger entry. Must be called inside
   * a session/transaction alongside the matching wallet debit.
   */
  private async creditGroupWallet(
    groupId: Types.ObjectId,
    amount: number,
    refs: { cycle: Types.ObjectId; contribution: Types.ObjectId },
    session: ClientSession,
  ): Promise<void> {
    let groupWallet = await this.groupWalletModel
      .findOne({ group: groupId })
      .session(session);

    if (!groupWallet) {
      [groupWallet] = await this.groupWalletModel.create(
        [{ group: groupId, balance: 0 }],
        { session },
      );
    }

    const balanceBefore = groupWallet.balance;
    const balanceAfter = balanceBefore + amount;

    groupWallet.balance = balanceAfter;
    await groupWallet.save({ session });

    await this.groupWalletTxModel.create(
      [
        {
          groupWallet: groupWallet._id,
          group: groupId,
          type: GroupWalletTransactionType.CONTRIBUTION_CREDIT,
          amount,
          balanceBefore,
          balanceAfter,
          cycle: refs.cycle,
          contribution: refs.contribution,
        },
      ],
      { session },
    );
  }

  /**
   * Debits the group's central account for a payout and records a
   * PAYOUT_DEBIT ledger entry. Must be called inside a
   * session/transaction.
   */
  private async debitGroupWallet(
    groupId: Types.ObjectId,
    amount: number,
    refs: { cycle: Types.ObjectId; payout: Types.ObjectId },
    session: ClientSession,
  ): Promise<void> {
    const groupWallet = await this.groupWalletModel
      .findOne({ group: groupId })
      .session(session);

    if (!groupWallet || groupWallet.balance < amount) {
      throw new BadRequestException(
        `Insufficient group wallet balance (have ${groupWallet?.balance ?? 0}, need ${amount})`,
      );
    }

    const balanceBefore = groupWallet.balance;
    const balanceAfter = balanceBefore - amount;

    groupWallet.balance = balanceAfter;
    await groupWallet.save({ session });

    await this.groupWalletTxModel.create(
      [
        {
          groupWallet: groupWallet._id,
          group: groupId,
          type: GroupWalletTransactionType.PAYOUT_DEBIT,
          amount,
          balanceBefore,
          balanceAfter,
          cycle: refs.cycle,
          payout: refs.payout,
        },
      ],
      { session },
    );
  }

  /**
   * Refunds a payout back to the group wallet (PAYOUT_REVERSAL_CREDIT).
   * Called by the Paystack webhook when a transfer is reversed.
   */
  private async reverseGroupWalletDebit(
    groupId: Types.ObjectId,
    amount: number,
    refs: { cycle: Types.ObjectId; payout: Types.ObjectId },
    session: ClientSession,
  ): Promise<void> {
    let groupWallet = await this.groupWalletModel
      .findOne({ group: groupId })
      .session(session);

    if (!groupWallet) {
      [groupWallet] = await this.groupWalletModel.create(
        [{ group: groupId, balance: 0 }],
        { session },
      );
    }

    const balanceBefore = groupWallet.balance;
    const balanceAfter = balanceBefore + amount;

    groupWallet.balance = balanceAfter;
    await groupWallet.save({ session });

    await this.groupWalletTxModel.create(
      [
        {
          groupWallet: groupWallet._id,
          group: groupId,
          type: GroupWalletTransactionType.PAYOUT_REVERSAL_CREDIT,
          amount,
          balanceBefore,
          balanceAfter,
          cycle: refs.cycle,
          payout: refs.payout,
        },
      ],
      { session },
    );
  }

  private async getCycleOrThrow(
    group: GroupDocument,
    cycleId: string,
  ): Promise<CycleDocument> {
    if (!Types.ObjectId.isValid(cycleId))
      throw new BadRequestException('Invalid cycle id');
    const cycle = await this.cycleModel.findOne({
      _id: cycleId,
      group: group._id,
    });
    if (!cycle) throw new NotFoundException('Cycle not found');
    return cycle;
  }

  private async populateCycle(
    cycleId: Types.ObjectId,
  ): Promise<PopulatedCycle> {
    const cycle = await this.cycleModel
      .findById(cycleId)
      .populate({
        path: 'recipientMember',
        populate: { path: 'user', select: MEMBER_USER_FIELDS },
      })
      .lean<PopulatedCycle>();
    if (!cycle) throw new NotFoundException('Cycle not found');
    return cycle;
  }

  // ---- Group activation -------------------------------------------------------

  /**
   * Admin-only. Locks in Cycle 1, creates a GroupWallet for the group,
   * and flips the group to ACTIVE. Also creates a personal Wallet for
   * every member who doesn't have one yet.
   */
  async activateGroup(adminUserId: string, groupId: string) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    if (group.status !== GroupStatus.ORDER_LOCKED) {
      throw new BadRequestException(
        'The group must have a locked rotation order before it can be activated',
      );
    }

    const members = await this.groupMemberModel
      .find({ group: group._id, inviteStatus: InviteStatus.ACCEPTED })
      .sort({ position: 1 });

    const recipient = members.find((m) => m.position === 1);
    if (!recipient)
      throw new BadRequestException('No member found at rotation position 1');

    // Eagerly provision wallets for all members so they can immediately
    // fund and contribute.
    await Promise.all(
      members.map((m) =>
        this.walletService.getOrCreateWallet(m.user.toString()),
      ),
    );

    const now = new Date();
    const dueDate = this.computeNextDueDate(now, group.frequency);
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // Create the group's central account.
        await this.groupWalletModel.create([{ group: group._id, balance: 0 }], {
          session,
        });

        await this.createCycleWithContributions(
          group,
          1, // round
          1, // cycleNumber
          recipient,
          dueDate,
          members,
          session,
        );

        group.status = GroupStatus.ACTIVE;
        group.startDate = now;
        group.currentRound = 1;
        group.currentCycleNumber = 1;
        await group.save({ session });
      });
    } finally {
      await session.endSession();
    }

    // Provision the group's escrow Dedicated Virtual Account (best-effort:
    // a Paystack outage must never block activation — the admin can retry
    // via POST :id/escrow-account/refresh).
    await this.escrowService.getOrCreateGroupEscrowAccount(group);

    void this.notificationsService.send(
      NotificationEvents.groupActivated({
        userIds: members.map((m) => m.user.toString()),
        groupName: group.name,
        contributionAmount: group.contributionAmount,
        frequency: group.frequency,
        dueDate,
        data: { groupId: group._id.toString() },
      }),
    );

    return this.getCurrentCycle(adminUserId, groupId);
  }

  // ---- Reading ----------------------------------------------------------------

  async listCycles(userId: string, groupId: string) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertAcceptedMember(group._id, userId);

    const cycles = await this.cycleModel
      .find({ group: group._id })
      .populate({
        path: 'recipientMember',
        populate: { path: 'user', select: MEMBER_USER_FIELDS },
      })
      .sort({ round: 1, cycleNumber: 1 })
      .lean<PopulatedCycle[]>();

    if (cycles.length === 0) return [];

    const cycleIds = cycles.map((c) => c._id);
    const contributions = await this.contributionModel
      .find({ cycle: { $in: cycleIds } })
      .select('cycle status')
      .lean();

    const paidCountByCycle = new Map<string, number>();
    for (const c of contributions) {
      if (c.status === ContributionStatus.PAID) {
        const key = c.cycle.toString();
        paidCountByCycle.set(key, (paidCountByCycle.get(key) ?? 0) + 1);
      }
    }

    return cycles.map((c) => ({
      ...c,
      paidCount: paidCountByCycle.get(c._id.toString()) ?? 0,
    }));
  }

  async getCurrentCycle(userId: string, groupId: string) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    const membership = await this.groupAccess.assertAcceptedMember(
      group._id,
      userId,
    );

    if (!group.currentCycleNumber) {
      throw new BadRequestException('This group has not been activated yet');
    }

    const cycle = await this.cycleModel.findOne({
      group: group._id,
      round: group.currentRound ?? 1,
      cycleNumber: group.currentCycleNumber,
    });
    if (!cycle) throw new NotFoundException('Current cycle not found');

    const [populatedCycle, contributions] = await Promise.all([
      this.populateCycle(cycle._id),
      this.contributionModel
        .find({ cycle: cycle._id })
        .populate('user', MEMBER_USER_FIELDS)
        .lean<PopulatedContribution[]>(),
    ]);

    await this.backfillPaymentReferences(group, contributions);

    return {
      cycle: populatedCycle,
      contributions,
      // The DVA members transfer into when paying by bank transfer. Null
      // until provisioning succeeds — the app shows a "provisioning" state.
      escrowAccount: this.escrowService.getStoredEscrowAccount(group),
      isAdmin: membership.isGroupAdmin,
      // Advisory only: lets the app warn the admin, before they tap
      // "Initiate payout", that the recipient still has to register a payout
      // bank account. `initiatePayout` is the source of truth.
      recipientPayoutReady: await this.recipientPayoutReady(populatedCycle),
    };
  }

  /**
   * Whether the cycle's recipient can actually receive a Paystack transfer.
   * Never throws — a failure here must not stop the app from rendering the
   * cycle; it just reports `false`.
   */
  private async recipientPayoutReady(cycle: PopulatedCycle): Promise<boolean> {
    const recipientUserId = cycle.recipientMember?.user?._id;
    if (!recipientUserId) return false;

    try {
      const recipient = await this.usersService.findById(
        recipientUserId.toString(),
      );
      return Boolean(recipient?.bankAccount?.paystackRecipientCode);
    } catch {
      return false;
    }
  }

  /**
   * Contributions created before `paymentReference` existed (or whose
   * group join code changed) get their narration reference filled in on
   * read, so the pay-by-transfer instructions always show one. Best-effort
   * — a write failure must never break reading the cycle.
   */
  private async backfillPaymentReferences(
    group: GroupDocument,
    contributions: PopulatedContribution[],
  ): Promise<void> {
    const missing = contributions.filter((c) => !c.paymentReference);

    if (missing.length === 0) return;

    try {
      const members = await this.groupMemberModel
        .find({
          group: group._id,
          _id: { $in: missing.map((c) => c.member) },
        })
        .select('position')
        .lean();

      const positionByMember = new Map(
        members.map((m) => [m._id.toString(), m.position ?? undefined]),
      );

      await Promise.all(
        missing.map((contribution) => {
          const reference = this.buildPaymentReference(
            group,
            positionByMember.get(contribution.member.toString()),
          );

          if (!reference) return Promise.resolve();

          contribution.paymentReference = reference;

          return this.contributionModel
            .updateOne(
              { _id: contribution._id },
              { paymentReference: reference },
            )
            .exec();
        }),
      );
    } catch (err) {
      this.logger.warn(
        `Failed to backfill payment references for group ${group._id.toString()}: ${String(err)}`,
      );
    }
  }

  // ---- Member-initiated payments ---------------------------------------------

  /**
   * Member pays their own contribution from their wallet. Debits the
   * contribution amount plus the platform's wallet -> escrow transfer fee,
   * credits the group's central wallet, and moves the contribution straight
   * to PAID — no admin involvement.
   *
   * The fee is a percentage of the amount moved (see
   * PlatformSetting.escrowTransferFeePercent), read at the moment of the
   * transfer so a rate change by a platform admin applies immediately.
   */
  async payContributionFromWallet(
    userId: string,
    groupId: string,
    contributionId: string,
  ) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertAcceptedMember(group._id, userId);

    const contribution = await this.getOwnContributionOrThrow(
      group,
      userId,
      contributionId,
    );

    if (contribution.status === ContributionStatus.PAID) {
      return this.getCurrentCycle(userId, groupId);
    }

    if (contribution.status === ContributionStatus.AWAITING_CONFIRMATION) {
      throw new BadRequestException(
        'This contribution is already awaiting the admin’s confirmation of your bank transfer.',
      );
    }

    const cycle = await this.getOpenCycleForContribution(group, contribution);
    const serviceFee = await this.platformSettings.calculateEscrowTransferFee(
      contribution.amount,
    );
    const totalDue = contribution.amount + serviceFee;

    const wallet = await this.walletService.getOrCreateWallet(userId);
    const balance = wallet.balance ?? 0;

    if (balance < totalDue) {
      throw new BadRequestException(
        `Insufficient wallet balance. You need ₦${totalDue.toLocaleString()} (contribution ₦${contribution.amount.toLocaleString()} + service fee ₦${serviceFee.toLocaleString()}) but have ₦${balance.toLocaleString()}. Please fund your wallet and try again.`,
      );
    }

    const platformAdmin = await this.usersService.findPlatformAdmin();
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const debited = await this.walletService.debitForContribution(
          contribution.user,
          contribution.amount,
          {
            group: group._id,
            cycle: cycle._id,
            contribution: contribution._id,
          },
          session,
          serviceFee,
        );

        if (!debited) {
          // Balance changed between the check above and the debit — abort
          // so nothing is half-applied.
          throw new BadRequestException(
            'Your wallet balance is no longer sufficient. Please fund your wallet and try again.',
          );
        }

        await this.creditGroupWallet(
          group._id,
          contribution.amount,
          { cycle: cycle._id, contribution: contribution._id },
          session,
        );

        if (serviceFee > 0) {
          await this.walletService.creditServiceFee(
            platformAdmin._id.toString(),
            serviceFee,
            {
              group: group._id,
              cycle: cycle._id,
              contribution: contribution._id,
            },
            session,
          );
        }

        contribution.serviceFee = serviceFee;
        contribution.paymentMethod = ContributionPaymentMethod.WALLET;
        contribution.status = ContributionStatus.PAID;
        contribution.paidAt = new Date();
        await contribution.save({ session });
      });
    } finally {
      await session.endSession();
    }

    const updatedWallet = await this.walletService.getOrCreateWallet(userId);

    void this.notificationsService.send(
      NotificationEvents.contributionPaid({
        userIds: [userId],
        groupName: group.name,
        amount: contribution.amount,
        newBalance: updatedWallet.balance ?? 0,
        serviceFee,
        data: { groupId, cycleId: cycle._id.toString() },
      }),
    );

    return this.getCurrentCycle(userId, groupId);
  }

  /**
   * Member reports they've sent a bank transfer into the group's escrow
   * account. The contribution moves to AWAITING_CONFIRMATION and the
   * service fee is charged up-front (refunded if the admin rejects the
   * claim). `debitServiceFee` throws when the wallet can't cover the fee,
   * which aborts the transaction and leaves the contribution PENDING.
   */
  async notifyBankTransferPayment(
    userId: string,
    groupId: string,
    contributionId: string,
    claimedReference?: string,
  ) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertAcceptedMember(group._id, userId);

    const contribution = await this.getOwnContributionOrThrow(
      group,
      userId,
      contributionId,
    );

    if (contribution.status === ContributionStatus.PAID) {
      throw new BadRequestException('This contribution has already been paid.');
    }

    const cycle = await this.getOpenCycleForContribution(group, contribution);
    const serviceFee = await this.platformSettings.calculateEscrowTransferFee(
      contribution.amount,
    );

    const adminMembership = await this.groupMemberModel.findOne({
      group: group._id,
      isGroupAdmin: true,
    });

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        if (serviceFee > 0) {
          await this.walletService.debitServiceFee(
            contribution.user,
            serviceFee,
            {
              group: group._id,
              cycle: cycle._id,
              contribution: contribution._id,
            },
            session,
          );
        }

        contribution.paymentMethod = ContributionPaymentMethod.BANK_TRANSFER;
        contribution.serviceFee = serviceFee;
        contribution.status = ContributionStatus.AWAITING_CONFIRMATION;
        contribution.paymentNotifiedAt = new Date();
        contribution.claimedTransferReference =
          claimedReference?.trim() || undefined;
        await contribution.save({ session });
      });
    } finally {
      await session.endSession();
    }

    if (adminMembership) {
      const memberUser = await this.usersService.findById(userId);

      void this.notificationsService.send(
        NotificationEvents.contributionAwaitingConfirmation({
          userIds: [adminMembership.user.toString()],
          memberName: memberUser?.name ?? memberUser?.phone ?? 'A member',
          groupName: group.name,
          amount: contribution.amount,
          reference:
            contribution.claimedTransferReference ??
            contribution.paymentReference,
          data: { groupId, cycleId: cycle._id.toString() },
        }),
      );
    }

    return this.getCurrentCycle(userId, groupId);
  }

  /**
   * Admin verifies a claimed bank transfer. If the matching escrow deposit
   * already landed (the webhook credited the group wallet on settle) it is
   * allocated to the contribution; otherwise the group wallet is credited
   * now (cash / out-of-band transfer the webhook never saw). Either way the
   * contribution becomes PAID and the platform service fee is credited.
   */
  async confirmContributionPaid(
    adminUserId: string,
    groupId: string,
    contributionId: string,
  ) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const contribution = await this.getContributionOrThrow(
      group,
      contributionId,
    );

    if (contribution.status === ContributionStatus.PAID) {
      return this.getCurrentCycle(adminUserId, groupId);
    }

    if (contribution.status !== ContributionStatus.AWAITING_CONFIRMATION) {
      throw new BadRequestException(
        'Only a contribution the member reported as paid by bank transfer can be confirmed.',
      );
    }

    const cycle = await this.getOpenCycleForContribution(group, contribution);
    // The fee was charged when the member reported the transfer
    // (notifyBankTransferPayment) and snapshotted on the contribution.
    // A contribution with no snapshot (created before service charges
    // existed) was confirmed without a fee, so it must not be charged now.
    const serviceFee = contribution.serviceFee ?? 0;

    const deposit =
      await this.escrowService.findUnallocatedDepositForContribution({
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
          // Money already settled in escrow and the group wallet was
          // credited by the webhook — just link it to the contribution.
          await this.escrowService.allocateDeposit(
            deposit,
            {
              cycle: cycle._id,
              contribution: contribution._id,
              adminUserId,
            },
            session,
          );
        } else {
          await this.creditGroupWallet(
            group._id,
            contribution.amount,
            { cycle: cycle._id, contribution: contribution._id },
            session,
          );
        }

        if (serviceFee > 0) {
          await this.walletService.creditServiceFee(
            platformAdmin._id.toString(),
            serviceFee,
            {
              group: group._id,
              cycle: cycle._id,
              contribution: contribution._id,
            },
            session,
          );
        }

        contribution.status = ContributionStatus.PAID;
        contribution.paymentMethod = ContributionPaymentMethod.BANK_TRANSFER;
        contribution.serviceFee = serviceFee;
        contribution.paidAt = new Date();
        contribution.confirmedBy = new Types.ObjectId(adminUserId);
        contribution.confirmedAt = new Date();
        await contribution.save({ session });
      });
    } finally {
      await session.endSession();
    }

    void this.notificationsService.send(
      NotificationEvents.contributionConfirmed({
        userIds: [contribution.user.toString()],
        groupName: group.name,
        amount: contribution.amount,
        roundLabel: `cycle ${cycle.cycleNumber}`,
        data: { groupId, cycleId: cycle._id.toString() },
      }),
    );

    return this.getCurrentCycle(adminUserId, groupId);
  }

  /**
   * Admin rejects a claimed bank transfer: the contribution returns to
   * PENDING, the service fee is refunded to the member's wallet, and any
   * escrow deposit the narration matcher pre-linked is released back to
   * the reconciliation queue (the money itself stays in the group wallet).
   */
  async rejectContributionPayment(
    adminUserId: string,
    groupId: string,
    contributionId: string,
    reason?: string,
  ) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const contribution = await this.getContributionOrThrow(
      group,
      contributionId,
    );

    if (contribution.status !== ContributionStatus.AWAITING_CONFIRMATION) {
      throw new BadRequestException(
        'Only a contribution awaiting confirmation can be rejected.',
      );
    }

    const cycle = await this.getOpenCycleForContribution(group, contribution);
    const serviceFee = contribution.serviceFee ?? 0;

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await this.escrowService.releaseDepositForContribution(
          group._id,
          contribution._id,
          session,
        );

        if (serviceFee > 0) {
          await this.walletService.refundServiceFee(
            contribution.user,
            serviceFee,
            {
              group: group._id,
              cycle: cycle._id,
              contribution: contribution._id,
            },
            session,
          );
        }

        contribution.status = ContributionStatus.PENDING;
        contribution.paymentMethod = undefined;
        contribution.serviceFee = 0;
        contribution.lastRejectedAt = new Date();
        contribution.lastRejectionReason = reason;
        await contribution.save({ session });
      });
    } finally {
      await session.endSession();
    }

    void this.notificationsService.send(
      NotificationEvents.contributionRejected({
        userIds: [contribution.user.toString()],
        groupName: group.name,
        amount: contribution.amount,
        reason,
        data: { groupId, cycleId: cycle._id.toString() },
      }),
    );

    return this.getCurrentCycle(adminUserId, groupId);
  }

  // ---- Payment helpers --------------------------------------------------------

  private async getContributionOrThrow(
    group: GroupDocument,
    contributionId: string,
  ): Promise<ContributionDocument> {
    if (!Types.ObjectId.isValid(contributionId)) {
      throw new BadRequestException('Invalid contribution id');
    }

    const contribution = await this.contributionModel.findOne({
      _id: contributionId,
      group: group._id,
    });

    if (!contribution) throw new NotFoundException('Contribution not found');

    return contribution;
  }

  private async getOwnContributionOrThrow(
    group: GroupDocument,
    userId: string,
    contributionId: string,
  ): Promise<ContributionDocument> {
    const contribution = await this.getContributionOrThrow(
      group,
      contributionId,
    );

    if (contribution.user.toString() !== userId) {
      throw new ForbiddenException('This contribution does not belong to you');
    }

    return contribution;
  }

  private async getOpenCycleForContribution(
    group: GroupDocument,
    contribution: ContributionDocument,
  ): Promise<CycleDocument> {
    const cycle = await this.cycleModel.findById(contribution.cycle);

    if (!cycle) throw new NotFoundException('Cycle not found');

    if (cycle.status !== CycleStatus.OPEN) {
      throw new BadRequestException('This cycle is no longer open');
    }

    return cycle;
  }

  // ---- Payout -----------------------------------------------------------------

  /**
   * Admin-only. Initiates a Paystack bank transfer of the pooled funds
   * from the group's central account to the cycle's recipient's bank
   * account.
   *
   * Requires:
   *  - All contributions for this cycle are PAID.
   *  - The recipient has a registered bank account (User.bankAccount).
   *  - This is the group's current cycle.
   *
   * The GroupWallet is debited immediately (within a transaction). The
   * Payout is created with status PENDING and advanced to SUCCESS or
   * FAILED by the Paystack transfer webhook.
   */
  async initiatePayout(adminUserId: string, groupId: string, cycleId: string) {
    // Fail before touching money: with no usable Paystack key the transfer
    // can never be sent, and the old debit → refund dance left a FAILED
    // payout plus two ledger entries behind on every attempt.
    this.paystack.assertConfigured();

    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const cycle = await this.getCycleOrThrow(group, cycleId);

    if (cycle.status !== CycleStatus.OPEN) {
      throw new BadRequestException('This cycle has already been paid out');
    }

    if (cycle.cycleNumber !== group.currentCycleNumber) {
      throw new BadRequestException(
        "This is not the group's current active cycle",
      );
    }

    // Payout requires every contribution to be PAID. A member's claimed
    // bank transfer (AWAITING_CONFIRMATION) is not paid until the admin
    // verifies it, so it blocks the payout like an unpaid one.
    //
    // The whole cycle is loaded (not just the unpaid rows) because the
    // payout amount is derived from what was actually collected — see
    // `payoutAmount` below.
    const cycleContributions = await this.contributionModel
      .find({ cycle: cycle._id })
      .select('status amount')
      .lean();

    if (cycleContributions.length === 0) {
      throw new BadRequestException(
        'Payout blocked: this cycle has no contributions to pay out',
      );
    }

    const unpaid = cycleContributions.filter((contribution) =>
      UNPAID_CONTRIBUTION_STATUSES.includes(contribution.status),
    );

    if (unpaid.length > 0) {
      const awaitingConfirmation = unpaid.filter(
        (c) => c.status === ContributionStatus.AWAITING_CONFIRMATION,
      ).length;
      const stillUnpaid = unpaid.length - awaitingConfirmation;

      const parts = [
        stillUnpaid > 0 ? `${stillUnpaid} member(s) have not paid` : null,
        awaitingConfirmation > 0
          ? `${awaitingConfirmation} payment(s) are awaiting your confirmation`
          : null,
      ].filter(Boolean);

      throw new BadRequestException(
        `Payout blocked: ${parts.join(' and ')}. Confirm or reject the claimed bank transfers, and wait for the remaining members to pay.`,
      );
    }

    const recipientMember = await this.groupMemberModel.findById(
      cycle.recipientMember,
    );
    if (!recipientMember)
      throw new NotFoundException('Recipient member not found');

    const recipientUser = await this.usersService.findById(
      recipientMember.user.toString(),
    );
    if (!recipientUser) throw new NotFoundException('Recipient user not found');

    if (!recipientUser.bankAccount?.paystackRecipientCode) {
      throw new BadRequestException(
        `The cycle recipient (${recipientUser.name ?? recipientUser.phone}) has not set up a payout bank account. They must add one via POST /wallet/bank-account before payout can proceed.`,
      );
    }

    // Pay out exactly what this cycle collected. `contributionAmount *
    // totalSlots` looks equivalent, but the group's settings (and roster)
    // can change after a cycle starts while every contribution keeps the
    // amount it was created with — using the live group settings then asks
    // the group wallet for money the members never paid and the payout dies
    // with "Insufficient group wallet balance".
    const payoutAmount = cycleContributions
      .filter((contribution) => contribution.status === ContributionStatus.PAID)
      .reduce((sum, contribution) => sum + contribution.amount, 0);

    if (payoutAmount <= 0) {
      throw new BadRequestException(
        'Payout blocked: this cycle has no confirmed contributions to pay out',
      );
    }

    // Platform payout charge: a percentage of the amount leaving escrow,
    // kept by the platform admin's wallet. The group's central account is
    // still debited the full payout — the fee simply never reaches the
    // recipient's bank account.
    const payoutFee =
      await this.platformSettings.calculatePayoutFee(payoutAmount);
    const netAmount = payoutAmount - payoutFee;

    if (netAmount <= 0) {
      throw new BadRequestException(
        `Payout blocked: the ₦${payoutAmount.toLocaleString()} collected doesn't cover the ₦${payoutFee.toLocaleString()} platform payout fee.`,
      );
    }

    const paystackReference = `payout_${cycleId}_${randomUUID()}`;

    // Debit the group wallet and create the Payout record inside a
    // transaction so they're always consistent.
    let payout: PayoutDocument;
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // One Payout document per cycle (unique index on `cycle`). A failed
        // attempt is refunded but keeps its document, so a retry MUST reuse
        // it: creating a second one trips the unique index and every later
        // "Initiate payout" tap dies with a duplicate-key 500.
        const existing = await this.payoutModel
          .findOne({ cycle: cycle._id })
          .session(session);

        if (existing) {
          if (existing.status === TransferStatus.SUCCESS) {
            throw new BadRequestException(
              'This cycle has already been paid out',
            );
          }

          if (existing.status === TransferStatus.PENDING) {
            throw new BadRequestException(
              'A payout for this cycle is already in progress. Wait for Paystack to confirm it before trying again.',
            );
          }

          existing.recipientMember = recipientMember._id;
          existing.recipientUser = recipientUser._id;
          existing.initiatedBy = new Types.ObjectId(adminUserId);
          existing.amount = payoutAmount;
          existing.fee = payoutFee;
          existing.netAmount = netAmount;
          existing.status = TransferStatus.PENDING;
          existing.paystackReference = paystackReference;
          existing.paystackTransferCode = undefined;
          existing.failureReason = undefined;
          existing.completedAt = undefined;
          await existing.save({ session });
          payout = existing;
        } else {
          const [payoutDoc] = await this.payoutModel.create(
            [
              {
                group: group._id,
                cycle: cycle._id,
                recipientMember: recipientMember._id,
                recipientUser: recipientUser._id,
                initiatedBy: new Types.ObjectId(adminUserId),
                amount: payoutAmount,
                fee: payoutFee,
                netAmount,
                status: TransferStatus.PENDING,
                paystackReference,
              },
            ],
            { session },
          );

          payout = payoutDoc;
        }

        await this.debitGroupWallet(
          group._id,
          payoutAmount,
          { cycle: cycle._id, payout: payout._id },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    // Initiate the Paystack transfer OUTSIDE the transaction (Paystack is
    // an external system — mixing it with a Mongo transaction would leave
    // the transaction open across a network call, which is unsafe). If
    // Paystack refuses the transfer, we update the Payout status to FAILED
    // and refund the group wallet.
    let transfer: InitiateTransferResult;

    try {
      transfer = await this.paystack.initiateTransfer({
        amountNaira: netAmount,
        recipientCode: recipientUser.bankAccount.paystackRecipientCode,
        reason: `Ajo payout – ${group.name} cycle ${cycle.cycleNumber}`,
        reference: paystackReference,
      });
    } catch (err) {
      const reason = this.describePayoutFailure(err);
      this.logger.error(
        `Paystack transfer failed for payout ${payout!._id.toString()}: ${reason}`,
      );
      await this.handleFailedPayout(payout!, group._id, cycle._id, reason);

      // Report the failure instead of returning a 200 with a FAILED payout
      // (which made the app announce "Payout initiated successfully" for a
      // transfer that never left Paystack). The group wallet is refunded by
      // handleFailedPayout, so the admin can retry immediately.
      throw new BadRequestException(
        `Payout could not be sent: ${reason}. Your group wallet has been refunded — please try again.`,
      );
    }

    payout!.paystackTransferCode = transfer.transferCode;

    // Persist the transfer code BEFORE finalizing. If local finalization
    // fails below, the code must survive so the Paystack webhook (or the
    // `seed:resolve-pending-payouts` reconciliation) can still complete it.
    await payout!.save();

    void this.notificationsService.send(
      NotificationEvents.payoutInitiated({
        userIds: [recipientUser._id.toString()],
        groupName: group.name,
        amount: netAmount,
        bankName: recipientUser.bankAccount.bankName,
        accountNumber: recipientUser.bankAccount.accountNumber,
        data: {
          groupId: group._id.toString(),
          cycleId: cycle._id.toString(),
        },
      }),
    );

    if (transfer.status === 'success') {
      await this.finalizeAcceptedPayout(payout!, cycle, group);
    } else if (transfer.status === 'otp' && this.paystack.isTestMode()) {
      // In test mode, Paystack returns 'otp' for transfers. Auto-resolve
      // with the test OTP so the payout completes without requiring a
      // webhook callback (which won't reach localhost).
      this.logger.log(
        `Test mode: resolving OTP for transfer ${transfer.transferCode}`,
      );

      try {
        await this.paystack.resolveOtp(
          transfer.transferCode,
          this.paystack.testTransferOtp(),
        );
      } catch (err) {
        // The OTP was rejected, so the transfer never left Paystack and the
        // money is still with us: fail + refund so the admin can retry.
        const reason = this.describePayoutFailure(err);
        this.logger.error(
          `Paystack transfer ${transfer.transferCode} could not be finalized ` +
            `with the test OTP: ${reason}`,
        );
        await this.handleFailedPayout(payout!, group._id, cycle._id, reason);

        throw new BadRequestException(
          `Payout could not be sent: ${reason}. Your group wallet has been refunded — please try again.`,
        );
      }

      // OTP accepted — the transfer is now committed at Paystack.
      await this.finalizeAcceptedPayout(payout!, cycle, group);
    }
    // 'pending' or 'otp' in live mode — the webhook finalizes.

    return this.payoutModel.findById(payout!._id).lean();
  }

  /**
   * Finalizes a payout that Paystack has already accepted.
   *
   * Deliberately never rethrows: the money is on its way, so a local failure
   * here (Mongo blip, missing rotation slot, ...) must NOT be reported as a
   * failed transfer — the caller would refund the group wallet and the
   * recipient would effectively be paid twice. The payout keeps its
   * `paystackTransferCode` and stays PENDING so the webhook (or
   * `seed:resolve-pending-payouts`) can finish it.
   */
  private async finalizeAcceptedPayout(
    payout: PayoutDocument,
    cycle: CycleDocument,
    group: GroupDocument,
  ): Promise<void> {
    try {
      await this.finalizeSuccessfulPayout(payout, cycle, group);
    } catch (err) {
      this.logger.error(
        `Payout ${payout._id.toString()} was accepted by Paystack (transfer ` +
          `${payout.paystackTransferCode ?? 'unknown'}) but local finalization ` +
          `failed: ${this.describePayoutFailure(err)}. Keeping it PENDING — ` +
          'the webhook will finalize it. Do not refund automatically.',
      );
    }
  }

  /**
   * Turns an unknown thrown value into a message fit for the admin's screen.
   * Paystack errors arrive as HttpExceptions whose response body carries the
   * gateway's own message, which is far more useful than `Error: ...`.
   */
  private describePayoutFailure(err: unknown): string {
    if (err instanceof HttpException) {
      const response = err.getResponse();

      if (typeof response === 'string') return response;

      if (response && typeof response === 'object') {
        const message = (response as { message?: string | string[] }).message;

        if (Array.isArray(message)) return message.join(' ');
        if (message) return message;
      }
    }

    if (err instanceof Error && err.message) return err.message;

    return String(err);
  }

  /**
   * Finalizes a successful payout: marks the recipient COLLECTED,
   * completes the cycle, and creates the next cycle (or marks the group
   * COMPLETED if it was the final one). Called either synchronously
   * (Paystack returned 'success' immediately) or from the webhook handler.
   */
  async finalizeSuccessfulPayout(
    payout: PayoutDocument,
    cycle: CycleDocument,
    group: GroupDocument,
  ): Promise<void> {
    // The platform's payout charge is only recognised once the transfer
    // actually succeeded — a failed transfer never earns it. Read the
    // platform admin before opening the transaction (it's a plain lookup).
    const payoutFee = payout.fee ?? 0;
    const platformAdmin =
      payoutFee > 0 ? await this.usersService.findPlatformAdmin() : null;

    const session = await this.connection.startSession();

    // Capture values set inside the transaction for use after it completes
    let nextCycleCreated = false;
    let nextCycleNumber: number | undefined;
    let nextDueDate: Date | undefined;
    let allMemberUserIds: string[] = [];

    try {
      await session.withTransaction(async () => {
        payout.status = TransferStatus.SUCCESS;
        payout.completedAt = new Date();
        await payout.save({ session });

        // Recognise the platform's payout charge on the admin wallet.
        if (platformAdmin && payoutFee > 0) {
          await this.walletService.creditServiceFee(
            platformAdmin._id.toString(),
            payoutFee,
            { group: group._id, cycle: cycle._id },
            session,
            {
              reference: `payout_fee_${payout._id.toString()}`,
              metadata: {
                source: 'payout_fee',
                payout: payout._id.toString(),
                grossAmount: payout.amount,
              },
            },
          );
        }

        cycle.status = CycleStatus.COMPLETED;
        cycle.completedAt = new Date();
        await cycle.save({ session });

        const recipientMember = await this.groupMemberModel
          .findById(cycle.recipientMember)
          .session(session);
        if (recipientMember) {
          recipientMember.payoutStatus = PayoutStatus.COLLECTED;
          await recipientMember.save({ session });
        }

        // Reset all other members' payoutStatus to PENDING for the next cycle
        const allMembers = await this.groupMemberModel
          .find({ group: group._id, inviteStatus: InviteStatus.ACCEPTED })
          .session(session);

        for (const member of allMembers) {
          if (member._id.toString() !== recipientMember?._id.toString()) {
            member.payoutStatus = PayoutStatus.PENDING;
            await member.save({ session });
          }
        }

        if (cycle.cycleNumber < group.totalSlots) {
          const nextPosition = cycle.cycleNumber + 1;
          const nextRecipient = await this.groupMemberModel
            .findOne({ group: group._id, position: nextPosition })
            .session(session);

          // A missing member at the next rotation position used to throw,
          // which rolled back this transaction AFTER Paystack had already
          // sent the money: the payout stayed PENDING forever, the group
          // wallet stayed debited and every retry answered "already in
          // progress". Close the group instead — the funds have moved, so
          // there is nothing left to schedule.
          if (!nextRecipient) {
            this.logger.warn(
              `Group ${group._id.toString()} has no member at rotation ` +
                `position ${nextPosition} (totalSlots=${group.totalSlots}); ` +
                'completing the group after the final payout.',
            );
            group.status = GroupStatus.COMPLETED;
            await group.save({ session });
            return;
          }

          const members = await this.groupMemberModel
            .find({ group: group._id, inviteStatus: InviteStatus.ACCEPTED })
            .session(session);
          const nextDue = this.computeNextDueDate(
            cycle.dueDate,
            group.frequency,
          );

          await this.createCycleWithContributions(
            group,
            cycle.round,
            nextPosition,
            nextRecipient,
            nextDue,
            members,
            session,
          );

          group.currentCycleNumber = nextPosition;

          // Capture for notification outside the transaction
          nextCycleCreated = true;
          nextCycleNumber = nextPosition;
          nextDueDate = nextDue;
          allMemberUserIds = members.map((m) => m.user.toString());
        } else {
          group.status = GroupStatus.COMPLETED;
        }

        await group.save({ session });
      });
    } finally {
      await session.endSession();
    }

    void this.notificationsService.send(
      NotificationEvents.payoutSuccess({
        userIds: [payout.recipientUser.toString()],
        groupName: group.name,
        amount: payout.netAmount || payout.amount,
        data: { groupId: group._id.toString(), cycleId: cycle._id.toString() },
      }),
    );

    // Broadcast cycle-advanced notification to ALL members so their mobile
    // apps can refresh immediately, regardless of who initiated the payout
    // or whether the payout completed synchronously or via webhook.
    if (nextCycleCreated && nextCycleNumber && nextDueDate) {
      void this.notificationsService.send(
        NotificationEvents.cycleAdvanced({
          userIds: allMemberUserIds,
          groupName: group.name,
          cycleNumber: nextCycleNumber,
          contributionAmount: group.contributionAmount,
          dueDate: nextDueDate,
          data: { groupId: group._id.toString() },
        }),
      );
    }
  }

  async handleFailedPayout(
    payout: PayoutDocument,
    groupId: Types.ObjectId,
    cycleId: Types.ObjectId,
    reason: string,
  ): Promise<void> {
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        payout.status = TransferStatus.FAILED;
        payout.failureReason = reason;
        await payout.save({ session });

        // Refund the group wallet so the admin can retry.
        await this.reverseGroupWalletDebit(
          groupId,
          payout.amount,
          { cycle: cycleId, payout: payout._id },
          session,
        );
      });
    } finally {
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
      void this.notificationsService.send(
        NotificationEvents.payoutFailed({
          userIds: [adminMembership.user.toString()],
          groupName: group.name,
          amount: payout.amount,
          reason,
          data: { groupId: groupId.toString(), cycleId: cycleId.toString() },
        }),
      );
    }
  }

  async handleReversedPayout(
    payout: PayoutDocument,
    group: GroupDocument,
  ): Promise<void> {
    // A reversal can arrive for a transfer that was still PENDING locally
    // (the webhook beat our finalization) or one we already marked
    // SUCCESS. In the second case the platform fee was already credited,
    // so it has to be clawed back alongside the group wallet refund.
    const feeWasCredited =
      payout.status === TransferStatus.SUCCESS && (payout.fee ?? 0) > 0;
    const platformAdmin = feeWasCredited
      ? await this.usersService.findPlatformAdmin()
      : null;
    const payoutFee = payout.fee ?? 0;

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        payout.status = TransferStatus.REVERSED;
        await payout.save({ session });

        await this.reverseGroupWalletDebit(
          group._id,
          payout.amount,
          { cycle: payout.cycle, payout: payout._id },
          session,
        );

        if (platformAdmin && feeWasCredited) {
          await this.walletService.reverseServiceFeeCredit(
            platformAdmin._id.toString(),
            payoutFee,
            { group: group._id, cycle: payout.cycle },
            session,
            {
              reference: `payout_fee_reversal_${payout._id.toString()}`,
              metadata: {
                source: 'payout_fee_reversal',
                payout: payout._id.toString(),
              },
            },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    const adminMembership = await this.groupMemberModel.findOne({
      group: group._id,
      isGroupAdmin: true,
    });

    if (adminMembership) {
      void this.notificationsService.send(
        NotificationEvents.payoutReversed({
          userIds: [adminMembership.user.toString()],
          groupName: group.name,
          amount: payout.netAmount || payout.amount,
          data: { groupId: group._id.toString() },
        }),
      );
    }
  }

  // ---- Payout lookup (used by webhook handler) --------------------------------

  async findPayoutByReference(
    reference: string,
  ): Promise<PayoutDocument | null> {
    return this.payoutModel.findOne({ paystackReference: reference });
  }

  async findGroupById(groupId: Types.ObjectId): Promise<GroupDocument | null> {
    return this.groupAccess
      .getGroupOrThrow(groupId.toString())
      .catch(() => null);
  }

  async findCycleById(cycleId: Types.ObjectId): Promise<CycleDocument | null> {
    return this.cycleModel.findById(cycleId);
  }
}
