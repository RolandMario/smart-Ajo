import {
  BadRequestException,
  forwardRef,
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
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';
import {
  ContributionFrequency,
  GroupStatus,
  InviteStatus,
  PayoutStatus,
} from '../common/enums/group.enum';
import { ContributionStatus, CycleStatus } from '../common/enums/cycle.enum';
import {
  GroupWalletTransactionType,
  TransferStatus,
} from '../common/enums/wallet.enum';
import {
  PopulatedContribution,
  PopulatedCycle,
} from './interfaces/populated-cycle.interface';

const MEMBER_USER_FIELDS = 'name phone email';

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
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
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

  private async createCycleWithContributions(
    group: GroupDocument,
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
          1,
          recipient,
          dueDate,
          members,
          session,
        );

        group.status = GroupStatus.ACTIVE;
        group.startDate = now;
        group.currentCycleNumber = 1;
        await group.save({ session });
      });
    } finally {
      await session.endSession();
    }

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
      .sort({ cycleNumber: 1 })
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
    const membership = await this.groupAccess.assertAcceptedMember(group._id, userId);

    if (!group.currentCycleNumber) {
      throw new BadRequestException('This group has not been activated yet');
    }

    const cycle = await this.cycleModel.findOne({
      group: group._id,
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

    return { cycle: populatedCycle, contributions, isAdmin: membership.isGroupAdmin };
  }

  // ---- Wallet contribution debit (replaces manual mark-paid) ------------------

  /**
   * Attempts to debit `contributionAmount` from every member's personal
   * wallet for the current open cycle, crediting the group's central
   * account for each successful debit. Members with insufficient balance
   * are skipped — their contribution remains PENDING.
   *
   * Returns a summary of who was debited and who still has a PENDING
   * contribution. Admin-triggered (manual button). See
   * `collectContributionsSystem` for the auto-collect cron path, which
   * shares the same core logic but skips the admin-permission check.
   */
  async collectContributions(
    adminUserId: string,
    groupId: string,
    cycleId: string,
  ) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const cycle = await this.getCycleOrThrow(group, cycleId);
    const results = await this.collectContributionsCore(group, cycle);

    const summary = await this.getCurrentCycle(adminUserId, groupId);

    return { results, ...summary };
  }

  /**
   * System-triggered counterpart of `collectContributions`, used by
   * `AutoCollectScheduler` for groups with `autoCollectEnabled: true`.
   * No admin user is involved — there's no permission check, since this
   * runs unattended on a schedule on the group's own behalf.
   */
  async collectContributionsSystem(group: GroupDocument, cycle: CycleDocument) {
    return this.collectContributionsCore(group, cycle);
  }

  private async collectContributionsCore(
    group: GroupDocument,
    cycle: CycleDocument,
  ): Promise<{ userId: string; success: boolean }[]> {
    if (cycle.status !== CycleStatus.OPEN) {
      throw new BadRequestException('This cycle is no longer open');
    }

    const pendingContributions = await this.contributionModel.find({
      cycle: cycle._id,
      status: ContributionStatus.PENDING,
    });

    // Get or create the platform admin wallet for service fee collection
    const platformAdmin = await this.usersService.findPlatformAdmin();
    const platformAdminWallet = await this.walletService.getOrCreateWallet(
      platformAdmin._id.toString(),
    );

    const results: { userId: string; success: boolean }[] = [];

    for (const contribution of pendingContributions) {
      const session = await this.connection.startSession();
      let debited = false;

      try {
        await session.withTransaction(async () => {
          const serviceFee = group.serviceFee;

          debited = await this.walletService.debitForContribution(
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

          if (debited) {
            await this.creditGroupWallet(
              group._id,
              contribution.amount,
              { cycle: cycle._id, contribution: contribution._id },
              session,
            );

            // Credit service fee to platform admin wallet if applicable
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
            contribution.status = ContributionStatus.PAID;
            contribution.paidAt = new Date();
            await contribution.save({ session });
          }

          results.push({
            userId: contribution.user.toString(),
            success: debited,
          });
        });
      } catch (err) {
        this.logger.error(
          `Failed to collect contribution ${contribution._id.toString()}: ${String(err)}`,
        );
        results.push({ userId: contribution.user.toString(), success: false });
      } finally {
        await session.endSession();
      }

      // Notify the member of the outcome. Done outside the transaction —
      // a notification failure must never roll back a financial debit.
      try {
        const wallet = await this.walletService.getOrCreateWallet(
          contribution.user.toString(),
        );

        if (debited) {
          void this.notificationsService.send(
            NotificationEvents.contributionDebited({
              userIds: [contribution.user.toString()],
              groupName: group.name,
              amount: contribution.amount,
              newBalance: wallet.balance,
              data: {
                groupId: group._id.toString(),
                cycleId: cycle._id.toString(),
              },
            }),
          );
        } else {
          const memberUser = await this.usersService.findById(
            contribution.user.toString(),
          );
          const phones = memberUser
            ? new Map([[contribution.user.toString(), memberUser.phone]])
            : undefined;

          void this.notificationsService.send(
            NotificationEvents.contributionFailedInsufficient({
              userIds: [contribution.user.toString()],
              groupName: group.name,
              amount: contribution.amount,
              currentBalance: wallet.balance,
              data: {
                groupId: group._id.toString(),
                cycleId: cycle._id.toString(),
              },
              phones,
            }),
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed to send contribution notification: ${String(err)}`,
        );
      }
    }

    return results;
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

    const pendingCount = await this.contributionModel.countDocuments({
      cycle: cycle._id,
      status: ContributionStatus.PENDING,
    });

    if (pendingCount > 0) {
      throw new BadRequestException(
        `${pendingCount} member(s) still have pending contributions. Run collect-contributions first.`,
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

    const payoutAmount = group.contributionAmount * group.totalSlots;
    const paystackReference = `payout_${cycleId}_${randomUUID()}`;

    // Debit the group wallet and create the Payout record inside a
    // transaction so they're always consistent.
    let payout: PayoutDocument;
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        const [payoutDoc] = await this.payoutModel.create(
          [
            {
              group: group._id,
              cycle: cycle._id,
              recipientMember: recipientMember._id,
              recipientUser: recipientUser._id,
              initiatedBy: new Types.ObjectId(adminUserId),
              amount: payoutAmount,
              status: TransferStatus.PENDING,
              paystackReference,
            },
          ],
          { session },
        );

        payout = payoutDoc;

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
    // Paystack fails, we update the Payout status to FAILED and refund
    // the group wallet.
    try {
      const transfer = await this.paystack.initiateTransfer({
        amountNaira: payoutAmount,
        recipientCode: recipientUser.bankAccount.paystackRecipientCode,
        reason: `Ajo payout – ${group.name} cycle ${cycle.cycleNumber}`,
        reference: paystackReference,
      });

      payout!.paystackTransferCode = transfer.transferCode;

      void this.notificationsService.send(
        NotificationEvents.payoutInitiated({
          userIds: [recipientUser._id.toString()],
          groupName: group.name,
          amount: payoutAmount,
          bankName: recipientUser.bankAccount.bankName,
          accountNumber: recipientUser.bankAccount.accountNumber,
          data: {
            groupId: group._id.toString(),
            cycleId: cycle._id.toString(),
          },
        }),
      );

      if (transfer.status === 'success') {
        await this.finalizeSuccessfulPayout(payout!, cycle, group);
      } else if (
        transfer.status === 'otp' &&
        this.paystack.isTestMode()
      ) {
        // In test mode, Paystack returns 'otp' for transfers. Auto-resolve
        // with the test OTP so the payout completes without requiring a
        // webhook callback (which won't reach localhost).
        this.logger.log(
          `Test mode: resolving OTP for transfer ${transfer.transferCode}`,
        );
        await this.paystack.resolveOtp(transfer.transferCode, '123456');
        await this.finalizeSuccessfulPayout(payout!, cycle, group);
      } else {
        // 'pending' or 'otp' in live mode — webhook will finalize.
        await payout!.save();
      }
    } catch (err) {
      this.logger.error(
        `Paystack transfer failed for payout ${payout!._id.toString()}: ${String(err)}`,
      );
      await this.handleFailedPayout(payout!, group._id, cycle._id, String(err));
    }

    return this.payoutModel.findById(payout!._id).lean();
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

          if (!nextRecipient)
            throw new BadRequestException(
              `No member at rotation position ${nextPosition}`,
            );

          const members = await this.groupMemberModel
            .find({ group: group._id, inviteStatus: InviteStatus.ACCEPTED })
            .session(session);
          const nextDue = this.computeNextDueDate(
            cycle.dueDate,
            group.frequency,
          );

          await this.createCycleWithContributions(
            group,
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
        amount: payout.amount,
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
          amount: payout.amount,
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
