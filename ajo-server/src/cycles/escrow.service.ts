import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../groups/schemas/group-member.schema';
import { GroupAccessService } from '../groups/group-access.service';
import {
  Contribution,
  ContributionDocument,
} from './schemas/contribution.schema';
import { Cycle, CycleDocument } from './schemas/cycle.schema';
import {
  GroupWallet,
  GroupWalletDocument,
} from './schemas/group-wallet.schema';
import {
  GroupWalletTransaction,
  GroupWalletTransactionDocument,
} from './schemas/group-wallet-transaction.schema';
import {
  EscrowDeposit,
  EscrowDepositDocument,
  EscrowDepositStatus,
} from './schemas/escrow-deposit.schema';
import { PaystackService } from '../payments/paystack.service';
import type { DedicatedAccountResult } from '../payments/paystack.service';
import { UsersService } from '../users/users.service';
import type { DedicatedAccount } from '../users/schemas/dedicated-account.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';
import { GroupWalletTransactionType } from '../common/enums/wallet.enum';
import { CycleStatus } from '../common/enums/cycle.enum';

/**
 * The public shape of a group's escrow account returned to members.
 * Deliberately a subset of the stored Paystack DVA (no customer code).
 */
export interface PublicEscrowAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  provider: string;
  currency: string;
  active: boolean;
}

/**
 * Owns each group's escrow account: the Paystack Dedicated Virtual
 * Account (DVA) that members transfer their contribution into when they
 * pay by local bank transfer.
 *
 * Responsibilities:
 *  - Provision/refresh a group's DVA (Paystack customer + dedicated
 *    account), provisioned best-effort when the group is activated.
 *  - Record inbound transfers (`charge.success`) as EscrowDeposits and
 *    credit the group's central wallet (GroupWallet) as the money
 *    settles.
 *  - Pre-link a deposit to the contribution whose `paymentReference`
 *    appears in the transfer narration, so the admin only has to confirm.
 *
 * Confirmation/rejection of a member's contribution stays in
 * CyclesService, so all contribution state transitions live in one place.
 */
@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(Contribution.name)
    private contributionModel: Model<ContributionDocument>,
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(GroupWallet.name)
    private groupWalletModel: Model<GroupWalletDocument>,
    @InjectModel(GroupWalletTransaction.name)
    private groupWalletTxModel: Model<GroupWalletTransactionDocument>,
    @InjectModel(EscrowDeposit.name)
    private escrowDepositModel: Model<EscrowDepositDocument>,
    @InjectConnection() private connection: Connection,
    private groupAccess: GroupAccessService,
    private paystack: PaystackService,
    private usersService: UsersService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Returns the group's escrow DVA, provisioning it on first call.
   *
   * A Paystack customer is created per group (synthetic email so the
   * group's customer can never be confused with a member's), then a DVA
   * is attached to it. The customer code and account number are stored on
   * `Group.escrowAccount` — the customer code is what the `charge.success`
   * webhook uses to route an inbound transfer to this group's escrow
   * rather than to a member's personal wallet.
   *
   * Best-effort by design: a Paystack outage must never block group
   * activation, so callers treat a `null` return as "not provisioned
   * yet" and can retry via `refreshGroupEscrowAccount`.
   */
  async getOrCreateGroupEscrowAccount(
    group: GroupDocument,
  ): Promise<DedicatedAccount | null> {
    const stored = group.escrowAccount;

    if (stored?.active && stored.accountNumber) {
      return stored;
    }

    const adminMembership = await this.groupMemberModel.findOne({
      group: group._id,
      isGroupAdmin: true,
    });

    if (!adminMembership) {
      this.logger.warn(
        `Group ${group._id.toString()} has no admin membership — cannot provision escrow account`,
      );
      return null;
    }

    const adminUser = await this.usersService.findById(
      adminMembership.user.toString(),
    );

    if (!adminUser?.phone) {
      this.logger.warn(
        `Group ${group._id.toString()} admin has no phone — cannot provision escrow account`,
      );
      return null;
    }

    const phone = adminUser.phone;

    try {
      // 1. Paystack customer for the GROUP (never reuses a member's code).
      const customerCode =
        stored?.paystackCustomerCode ??
        (
          await this.paystack.createCustomer({
            firstName: group.name,
            phone,
            email: `group-${group.joinCode.toLowerCase()}@ajo.app`,
          })
        ).customerCode;

      if (customerCode !== stored?.paystackCustomerCode) {
        group.escrowAccount = {
          paystackCustomerCode: customerCode,
          provider: 'paystack',
          currency: 'NGN',
          active: false,
        };
        await group.save();
      }

      // 2. Request the virtual account (reuses the DVA bank-fallback logic).
      let result: DedicatedAccountResult;

      try {
        result = await this.paystack.createDedicatedAccount({
          customerCode,
          preferredBank: this.paystack.dvaPreferredBank(),
          phone,
          firstName: group.name,
        });
      } catch (err) {
        const existing =
          await this.paystack.fetchDedicatedAccounts(customerCode);
        const fallback = existing.find((dva) => dva.active) ?? existing[0];

        if (!fallback?.accountNumber) {
          throw err;
        }

        result = fallback;
      }

      const escrowAccount: DedicatedAccount = {
        paystackCustomerCode: customerCode,
        paystackAccountId: result.accountId,
        accountNumber: result.accountNumber,
        accountName: result.accountName,
        bankName: result.bankName,
        provider: 'paystack',
        currency: result.currency || 'NGN',
        active: result.active,
      };

      group.escrowAccount = escrowAccount;
      await group.save();

      this.logger.log(
        `Escrow account provisioned for group ${group._id.toString()}: ${escrowAccount.bankName} ${escrowAccount.accountNumber}`,
      );

      return escrowAccount;
    } catch (err) {
      this.logger.error(
        `Failed to provision escrow account for group ${group._id.toString()}: ${String(err)}`,
      );
      return null;
    }
  }

  /**
   * Admin-only. Deactivates the current escrow DVA and requests a fresh
   * one (e.g. if Paystack invalidated the number). Mirrors
   * WalletService.refreshDedicatedAccount.
   */
  async refreshGroupEscrowAccount(
    adminUserId: string,
    groupId: string,
  ): Promise<PublicEscrowAccount | null> {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const stored = group.escrowAccount;

    if (stored?.active && stored.accountNumber) {
      stored.active = false;

      if (stored.paystackAccountId) {
        try {
          await this.paystack.deactivateDedicatedAccount(
            stored.paystackAccountId,
          );
          stored.paystackAccountId = undefined;
        } catch {
          // Paystack refused — getOrCreateGroupEscrowAccount recovers the
          // existing assignment below.
        }
      }

      group.escrowAccount = stored;
      await group.save();
    }

    const account = await this.getOrCreateGroupEscrowAccount(group);
    return account ? this.toPublic(account) : null;
  }

  /**
   * Member-facing read of the group's escrow account. Returns `null` when
   * the DVA hasn't been provisioned yet, so the app can show a
   * "provisioning" state instead of an error. Does not provision — that
   * happens at activation and via the admin refresh endpoint.
   */
  async getEscrowAccount(
    userId: string,
    groupId: string,
  ): Promise<PublicEscrowAccount | null> {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertAcceptedMember(group._id, userId);

    return this.getStoredEscrowAccount(group);
  }

  /**
   * The group's escrow DVA details without an authorization check — for
   * payloads already authorized by the caller (e.g. the current-cycle
   * response). Returns `null` until provisioning succeeds.
   */
  getStoredEscrowAccount(group: GroupDocument): PublicEscrowAccount | null {
    const account = group.escrowAccount;

    if (!account?.accountNumber) return null;

    return this.toPublic(account);
  }

  private toPublic(account: DedicatedAccount): PublicEscrowAccount {
    return {
      bankName: account.bankName ?? '',
      accountName: account.accountName ?? '',
      accountNumber: account.accountNumber ?? '',
      provider: account.provider,
      currency: account.currency,
      active: account.active,
    };
  }
  // ---- Inbound transfers (webhook) -------------------------------------------

  /**
   * Records a settled bank transfer into a group's escrow DVA.
   *
   * Matching is by Paystack `customer_code` first (each group has its own
   * Paystack customer, so this can never collide with a member's personal
   * DVA), falling back to the receiving account number. Returns `true`
   * when the transfer was recognised as a group escrow deposit and
   * handled, `false` when it isn't ours (the caller then falls through to
   * the member-wallet path).
   *
   * The group's central wallet is credited immediately — the money has
   * genuinely settled in the escrow account — and an EscrowDeposit is
   * recorded for the admin to approve. Idempotent: the deposit's
   * `providerReference` is unique, so a re-delivered webhook is a no-op.
   */
  async creditEscrowDeposit(params: {
    customerCode?: string;
    accountNumber?: string;
    amountNaira: number;
    reference: string;
    paystackData?: Record<string, unknown>;
  }): Promise<boolean> {
    const group = await this.findGroupByEscrowDetails(params);

    if (!group) {
      return false;
    }

    if (params.amountNaira <= 0) {
      return false;
    }

    const existing = await this.escrowDepositModel.findOne({
      providerReference: params.reference,
    });

    if (existing) {
      // Already recorded by a prior webhook delivery.
      return true;
    }

    const { senderName, senderBank, narration } = this.extractSenderDetails(
      params.paystackData,
    );

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await this.creditGroupWallet(group._id, params.amountNaira, session);

        await this.escrowDepositModel.create(
          [
            {
              group: group._id,
              escrowAccountNumber:
                params.accountNumber ??
                group.escrowAccount?.accountNumber ??
                '',
              amount: params.amountNaira,
              providerReference: params.reference,
              senderName,
              senderBank,
              narration,
              receivedAt: new Date(),
              status: EscrowDepositStatus.UNALLOCATED,
              rawPayload: params.paystackData,
            },
          ],
          { session },
        );
      });
    } catch (err) {
      // Duplicate providerReference (concurrent delivery) is fine.
      const mongoErr = err as {
        code?: unknown;
        message?: unknown;
        err?: { code?: unknown };
      };
      const code = mongoErr?.code ?? mongoErr?.err?.code;
      const message = String(mongoErr?.message ?? err);
      if (code === 11000 || code === '11000' || message.includes('E11000')) {
        return true;
      }
      throw err;
    } finally {
      await session.endSession();
    }

    await this.prefillDepositMatch(group, params.reference, narration);
    await this.notifyAdminOfDeposit(group, params.amountNaira, senderName);

    this.logger.log(
      `Escrow deposit recorded: group=${group._id.toString()} amount=${params.amountNaira} ref=${params.reference}`,
    );

    return true;
  }

  private async findGroupByEscrowDetails(params: {
    customerCode?: string;
    accountNumber?: string;
  }): Promise<GroupDocument | null> {
    if (params.customerCode) {
      const byCustomer = await this.groupModel.findOne({
        'escrowAccount.paystackCustomerCode': params.customerCode,
      });
      if (byCustomer) return byCustomer;
    }

    if (params.accountNumber) {
      return this.groupModel.findOne({
        'escrowAccount.accountNumber': params.accountNumber,
      });
    }

    return null;
  }

  /**
   * Best-effort pre-link: if the transfer narration carries a member's
   * `paymentReference` (e.g. `AJO-3F9K2A-2`), link the deposit to that
   * contribution so the admin only has to tap Confirm. The deposit stays
   * UNALLOCATED until the admin confirms.
   */
  private async prefillDepositMatch(
    group: GroupDocument,
    reference: string,
    narration?: string,
  ): Promise<void> {
    if (!narration) return;

    try {
      const cycle = await this.currentCycle(group);

      if (!cycle) return;

      const paymentReference = this.normalizeReference(narration);

      if (!paymentReference) return;

      const contribution = await this.contributionModel.findOne({
        cycle: cycle._id,
        paymentReference,
      });

      if (!contribution) return;

      await this.escrowDepositModel.updateOne(
        { providerReference: reference },
        { $set: { cycle: cycle._id, contribution: contribution._id } },
      );
    } catch (err) {
      this.logger.error(
        `Failed to pre-match escrow deposit ${reference}: ${String(err)}`,
      );
    }
  }

  /**
   * Extracts an `AJO-XXXXXXXX-N`-style reference from a narration, ignoring
   * surrounding bank boilerplate. Returns null when none is present.
   */
  private normalizeReference(narration: string): string | null {
    const match = narration.toUpperCase().match(/AJO-[A-Z0-9]+-\d+/);
    return match ? match[0] : null;
  }

  private extractSenderDetails(data?: Record<string, unknown>): {
    senderName?: string;
    senderBank?: string;
    narration?: string;
  } {
    if (!data) return {};

    const authorization =
      (data.authorization as Record<string, unknown> | undefined) ?? {};

    const asString = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim().length > 0 ? value : undefined;

    return {
      senderName:
        asString(authorization.sender_name) ?? asString(data.sender_name),
      senderBank: asString(authorization.sender_bank),
      narration: asString(data.narration) ?? asString(authorization.narration),
    };
  }

  private async currentCycle(
    group: GroupDocument,
  ): Promise<CycleDocument | null> {
    if (!group.currentCycleNumber) return null;

    return this.cycleModel.findOne({
      group: group._id,
      round: group.currentRound ?? 1,
      cycleNumber: group.currentCycleNumber,
      status: CycleStatus.OPEN,
    });
  }

  /**
   * Credits the group's central wallet for a settled escrow transfer,
   * recording an ESCROW_DEPOSIT_CREDIT ledger entry. Must be called
   * inside a session/transaction.
   */
  private async creditGroupWallet(
    groupId: Types.ObjectId,
    amount: number,
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
          type: GroupWalletTransactionType.ESCROW_DEPOSIT_CREDIT,
          amount,
          balanceBefore,
          balanceAfter,
        },
      ],
      { session },
    );
  }

  private async notifyAdminOfDeposit(
    group: GroupDocument,
    amount: number,
    senderName?: string,
  ): Promise<void> {
    try {
      const adminMembership = await this.groupMemberModel.findOne({
        group: group._id,
        isGroupAdmin: true,
      });

      if (!adminMembership) return;

      void this.notificationsService.send(
        NotificationEvents.escrowDepositReceived({
          userIds: [adminMembership.user.toString()],
          groupName: group.name,
          amount,
          senderName,
          data: { groupId: group._id.toString() },
        }),
      );
    } catch (err) {
      this.logger.error(
        `Failed to notify admin of escrow deposit: ${String(err)}`,
      );
    }
  }

  // ---- Admin reconciliation ---------------------------------------------------

  /**
   * Admin-only. The group's escrow deposits, newest first — the
   * reconciliation queue the group admin works through.
   */
  async listDeposits(adminUserId: string, groupId: string) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const deposits = await this.escrowDepositModel
      .find({ group: group._id })
      .populate('contribution', 'amount paymentReference status')
      .sort({ receivedAt: -1 })
      .limit(100)
      .lean();

    return deposits.map((deposit) => ({
      id: deposit._id.toString(),
      amount: deposit.amount,
      escrowAccountNumber: deposit.escrowAccountNumber,
      providerReference: deposit.providerReference,
      senderName: deposit.senderName,
      senderBank: deposit.senderBank,
      narration: deposit.narration,
      receivedAt: deposit.receivedAt,
      status: deposit.status,
      cycleId: deposit.cycle?.toString(),
      contribution: deposit.contribution,
      allocatedAt: deposit.allocatedAt,
    }));
  }

  /**
   * Finds the escrow deposit that backs a member's claimed bank transfer,
   * so `confirmContributionPaid` can allocate it instead of crediting the
   * group wallet a second time. Prefers a deposit the webhook already
   * pre-linked by narration reference, then falls back to the most recent
   * unallocated deposit in the same cycle for exactly the contribution
   * amount (the admin explicitly picked the member, so an amount match is
   * enough to attribute it).
   */
  async findUnallocatedDepositForContribution(params: {
    groupId: Types.ObjectId;
    cycleId: Types.ObjectId;
    contributionId: Types.ObjectId;
    amount: number;
  }): Promise<EscrowDepositDocument | null> {
    const linked = await this.escrowDepositModel.findOne({
      group: params.groupId,
      contribution: params.contributionId,
      status: EscrowDepositStatus.UNALLOCATED,
    });

    if (linked) return linked;

    return this.escrowDepositModel.findOne({
      group: params.groupId,
      cycle: params.cycleId,
      contribution: { $exists: false },
      status: EscrowDepositStatus.UNALLOCATED,
      amount: params.amount,
    });
  }

  /**
   * Marks a deposit as allocated to a contribution (the admin confirmed
   * it). Must be called inside the caller's transaction so the deposit
   * and the contribution flip together.
   */
  async allocateDeposit(
    deposit: EscrowDepositDocument,
    refs: {
      cycle: Types.ObjectId;
      contribution: Types.ObjectId;
      adminUserId: string;
    },
    session: ClientSession,
  ): Promise<void> {
    deposit.status = EscrowDepositStatus.ALLOCATED;
    deposit.cycle = refs.cycle;
    deposit.contribution = refs.contribution;
    deposit.allocatedBy = new Types.ObjectId(refs.adminUserId);
    deposit.allocatedAt = new Date();
    await deposit.save({ session });
  }

  /**
   * Releases a deposit back to the reconciliation queue — used when the
   * group admin rejects a claimed transfer, so the money stays available
   * to be allocated to the correct member later. Must be called inside
   * the caller's transaction.
   */
  async releaseDepositForContribution(
    groupId: Types.ObjectId,
    contributionId: Types.ObjectId,
    session: ClientSession,
  ): Promise<void> {
    await this.escrowDepositModel.updateMany(
      {
        group: groupId,
        contribution: contributionId,
        status: EscrowDepositStatus.UNALLOCATED,
      },
      { $unset: { contribution: '', cycle: '' } },
      { session },
    );
  }

  /**
   * Finds a deposit by its contribution link (used to decide whether the
   * escrow money for a bank-transfer contribution has already arrived).
   */
  async findDepositForContribution(
    contributionId: Types.ObjectId,
  ): Promise<EscrowDepositDocument | null> {
    return this.escrowDepositModel.findOne({
      contribution: contributionId,
      status: EscrowDepositStatus.ALLOCATED,
    });
  }
}
