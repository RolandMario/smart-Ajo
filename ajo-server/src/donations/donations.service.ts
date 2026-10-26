import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Connection, Model, Types } from 'mongoose';
import {
  DonationGroup,
  DonationGroupDocument,
} from './schemas/donation-group.schema';
import {
  DonationMember,
  DonationMemberDocument,
} from './schemas/donation-member.schema';
import { Donation, DonationDocument } from './schemas/donation.schema';
import {
  DonationPayout,
  DonationPayoutDocument,
} from './schemas/donation-payout.schema';
import {
  DonationEscrowTransaction,
  DonationEscrowTransactionDocument,
} from './schemas/donation-escrow-transaction.schema';
import {
  DonationAmountType,
  DonationEscrowTransactionType,
  DonationGroupStatus,
  DonationSchedule,
} from '../common/enums/donation.enum';
import { TransferStatus } from '../common/enums/wallet.enum';
import { WalletService } from '../wallet/wallet.service';
import { PaystackService } from '../payments/paystack.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { NotificationEvents } from '../notifications/notification-events';
import { generateJoinCode, normalizeJoinCode } from '../groups/join-code';
import { CreateDonationGroupDto } from './dto/create-donation-group.dto';
import { DonateDto } from './dto/donate.dto';
import { SetDonationPayoutAccountDto } from './dto/set-payout-account.dto';
import { CreateDonationPayoutDto } from './dto/create-donation-payout.dto';
import { ListDonationsQueryDto } from './dto/list-donations-query.dto';
import {
  DONATION_MAX_PAGE_SIZE,
  DONATION_MIN_AMOUNT,
  DONATION_PAGE_SIZE,
  DONATION_PAYOUT_MIN_AMOUNT,
  DONATION_RECENT_LIMIT,
  DONATION_TERMINATION_VOTE_DENOMINATOR,
  DONATION_TERMINATION_VOTE_NUMERATOR,
} from './donation.constants';
import {
  currentPeriodKey,
  nextPeriodStart,
  periodLabel,
} from './utils/donation-period';

/** Where a payout will be sent and why. */
export interface DonationPayoutDestination {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  paystackRecipientCode: string;
  /** `pool` when the admin overrode it, `admin` for their saved account. */
  source: 'pool' | 'admin';
}

/** Donation row enriched with the donor's display name. */
export interface DonationWithDonor {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  user: Types.ObjectId;
  amount: number;
  period: string;
  reference: string;
  createdAt?: Date;
  donorName: string;
}

/**
 * Where the pool stands on being terminated by member vote.
 *
 * `eligibleCount` is the number of members who have made 100% of their
 * payment towards the pool — the only members whose yes votes count.
 * `requiredVotes` is 2/3 of that number, rounded up.
 *
 * Two independent gates must both be open before the pool may be terminated:
 * the 2/3 yes vote (`votesMet`) and every naira donated already paid out
 * (`fundsUtilized`). Only the pool admin may press the button.
 */
export interface DonationTerminationStanding {
  /** The caller's own vote (the switch on the pool screen). */
  myVote: boolean;
  /** True when the caller has made 100% of their payment and may vote. */
  eligible: boolean;
  /** Members who have made 100% of their payment towards the pool. */
  eligibleCount: number;
  /** Yes votes cast by eligible members. */
  votes: number;
  /** 2/3 of `eligibleCount`, rounded up (0 when nobody is eligible). */
  requiredVotes: number;
  /** True once 2/3 of the eligible members voted yes. */
  votesMet: boolean;
  /** Lifetime donations received by the pool. */
  totalCollected: number;
  /** Lifetime amount successfully paid out of the pool. */
  totalPaidOut: number;
  /**
   * True when everything donated has been paid out (`totalPaidOut` equals
   * `totalCollected`, i.e. nothing is left in escrow) — the pool money has
   * been used for the purpose it was collected for.
   */
  fundsUtilized: boolean;
  /** True when BOTH the vote and the paid-out condition are satisfied. */
  canTerminate: boolean;
  /** True when the pool has already been terminated. */
  terminated: boolean;
  /** Share of the eligible members who voted yes, 0-100. */
  percentVoted: number;
}

/** What `terminateGroup` answers once the pool has been deleted. */
export interface DonationPoolTermination {
  groupId: string;
  status: DonationGroupStatus.TERMINATED;
}

/** Outcome of the one-off cleanup of legacy soft-terminated pools. */
export interface DonationPoolPurgeResult {
  scanned: number;
  purged: Array<{ id: string; name: string }>;
  /** Pools still holding escrow money — purged only after a payout. */
  skipped: Array<{ id: string; name: string; balance: number }>;
}

@Injectable()
export class DonationsService {
  private readonly logger = new Logger(DonationsService.name);

  constructor(
    @InjectModel(DonationGroup.name)
    private donationGroupModel: Model<DonationGroupDocument>,
    @InjectModel(DonationMember.name)
    private donationMemberModel: Model<DonationMemberDocument>,
    @InjectModel(Donation.name)
    private donationModel: Model<DonationDocument>,
    @InjectModel(DonationPayout.name)
    private donationPayoutModel: Model<DonationPayoutDocument>,
    @InjectModel(DonationEscrowTransaction.name)
    private escrowTxModel: Model<DonationEscrowTransactionDocument>,
    @InjectConnection() private connection: Connection,
    private walletService: WalletService,
    private paystack: PaystackService,
    private usersService: UsersService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
    private platformSettings: PlatformSettingsService,
  ) {}

  // ---- Guards / small helpers ----------------------------------------------

  /** Loads a pool or throws a 404 the mobile app can show verbatim. */
  private async requireGroup(groupId: string): Promise<DonationGroupDocument> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new NotFoundException('Pool not found');
    }
    const group = await this.donationGroupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Pool not found');
    }
    return group;
  }

  private async requireMembership(
    groupId: Types.ObjectId,
    userId: string,
  ): Promise<DonationMemberDocument> {
    const member = await this.donationMemberModel.findOne({
      group: groupId,
      user: new Types.ObjectId(userId),
    });
    if (!member) {
      throw new NotFoundException('You are not a member of this pool');
    }
    return member;
  }

  private async requireAdmin(
    groupId: string,
    userId: string,
  ): Promise<DonationGroupDocument> {
    const group = await this.requireGroup(groupId);
    if (group.admin.toString() !== userId) {
      throw new BadRequestException(
        'Only the pool admin can perform this action.',
      );
    }
    return group;
  }

  /** Mongo duplicate-key error (E11000), possibly wrapped by the driver. */
  private isDuplicateKeyError(err: unknown): boolean {
    const code = (err as { code?: number | string } | null)?.code;
    const message = String(
      (err as { message?: string } | null)?.message ?? err,
    );
    return code === 11000 || code === '11000' || message.includes('E11000');
  }

  /** Clamps a page/limit pair to something sane. */
  private paging(query: ListDonationsQueryDto) {
    const limit = Math.min(
      query.limit && query.limit > 0
        ? Math.trunc(query.limit)
        : DONATION_PAGE_SIZE,
      DONATION_MAX_PAGE_SIZE,
    );
    const requestedPage =
      query.page && query.page > 0 ? Math.trunc(query.page) : 1;
    return { limit, requestedPage };
  }

  /**
   * Adds `donorName` to donation rows in one batched user lookup. Falls back
   * to a neutral label when the donor never set a name, and deliberately does
   * not expose phone numbers to fellow pool members.
   */
  private async withDonorNames(
    rows: Array<{
      _id: Types.ObjectId;
      group: Types.ObjectId;
      user: Types.ObjectId;
      amount: number;
      period: string;
      reference: string;
      createdAt?: Date;
    }>,
  ): Promise<DonationWithDonor[]> {
    if (rows.length === 0) return [];

    const users = await this.usersService.findByIds(
      rows.map((row) => row.user),
    );
    const byId = new Map(users.map((user) => [user._id.toString(), user]));

    return rows.map((row) => {
      const donor = byId.get(row.user.toString());
      return {
        ...row,
        donorName: donor?.name?.trim() || 'Ajo member',
      };
    });
  }

  /** Human label for the donation window ("today", "one-time", ...). */
  private windowLabel(group: DonationGroupDocument): string {
    return periodLabel(group.schedule, group.frequency);
  }

  /** Inserts a membership row, or returns the existing one (idempotent). */
  private async findOrCreateMembership(
    groupId: Types.ObjectId,
    userId: string,
  ): Promise<{ member: DonationMemberDocument; created: boolean }> {
    const user = new Types.ObjectId(userId);
    const existing = await this.donationMemberModel.findOne({
      group: groupId,
      user,
    });
    if (existing) {
      return { member: existing, created: false };
    }

    try {
      const member = await this.donationMemberModel.create({
        group: groupId,
        user,
        joinedAt: new Date(),
        totalDonated: 0,
        donationCount: 0,
      });
      return { member, created: true };
    } catch (err) {
      // Concurrent join — the unique {group, user} index rejected the second
      // insert, so the caller's intent is already satisfied.
      if (this.isDuplicateKeyError(err)) {
        const member = await this.donationMemberModel.findOne({
          group: groupId,
          user,
        });
        if (member) {
          return { member, created: false };
        }
      }
      throw err;
    }
  }

  /**
   * The bank account a pool pays out to: the pool-level override when the
   * admin set one, otherwise the admin's own saved `User.bankAccount`.
   * Returns `null` when neither exists.
   */
  private async resolvePayoutDestination(
    group: DonationGroupDocument,
  ): Promise<DonationPayoutDestination | null> {
    if (group.payoutAccount?.paystackRecipientCode) {
      const account = group.payoutAccount;
      return {
        bankName: account.bankName,
        bankCode: account.bankCode,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        paystackRecipientCode: account.paystackRecipientCode,
        source: 'pool',
      };
    }

    const admin = await this.usersService.findById(group.admin.toString());
    const account = admin?.bankAccount;
    if (!account?.paystackRecipientCode) {
      return null;
    }

    return {
      bankName: account.bankName,
      bankCode: account.bankCode,
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      paystackRecipientCode: account.paystackRecipientCode,
      source: 'admin',
    };
  }

  /**
   * Works out whether the caller may donate right now, and why not.
   * "Now" is the current calendar period (or `once` for one-time pools).
   */
  private async describeDonationWindow(
    group: DonationGroupDocument,
    userId: string,
    now: Date = new Date(),
  ) {
    const period = currentPeriodKey(group.schedule, group.frequency, now);
    const existing = await this.donationModel
      .findOne({ group: group._id, user: new Types.ObjectId(userId), period })
      .select('amount createdAt')
      .lean();

    const nextDonationAt =
      group.schedule === DonationSchedule.INTERVAL && group.frequency
        ? nextPeriodStart(group.frequency, now)
        : null;

    let canDonate = true;
    let reason: string | undefined;

    if (group.status === DonationGroupStatus.TERMINATED) {
      canDonate = false;
      reason = 'This pool was terminated by a vote of its members.';
    } else if (group.status !== DonationGroupStatus.ACTIVE) {
      canDonate = false;
      reason = 'This pool is no longer accepting donations.';
    } else if (existing) {
      canDonate = false;
      reason =
        group.schedule === DonationSchedule.ONE_TIME
          ? 'You have already donated to this pool.'
          : `You have already donated ${this.windowLabel(group)}.`;
    }

    return {
      period,
      alreadyDonated: Boolean(existing),
      lastDonationAmount: existing?.amount,
      nextDonationAt,
      canDonate,
      reason,
    };
  }

  // ---- Termination vote -----------------------------------------------------

  /**
   * The members who have made 100% of their payment towards the pool.
   *
   * - ONE_TIME pools: the member has made their one-time donation. For a
   *   FIXED pool `donate` forces the amount to `group.amount`, so a single
   *   donation literally is 100% of the fixed contribution.
   * - INTERVAL pools: the member has paid for the current period, i.e. they
   *   are up to date for this cycle.
   *
   * Returned as a set of user-id strings so it can be intersected with
   * `terminationVotes` cheaply.
   */
  private async fullyPaidUserIds(
    group: DonationGroupDocument,
    now: Date = new Date(),
  ): Promise<Set<string>> {
    const members = await this.donationMemberModel
      .find({ group: group._id })
      .select('user donationCount')
      .lean();

    if (group.schedule === DonationSchedule.ONE_TIME) {
      return new Set(
        members
          .filter((member) => (member.donationCount ?? 0) > 0)
          .map((member) => member.user.toString()),
      );
    }

    const period = currentPeriodKey(group.schedule, group.frequency, now);
    const paid = await this.donationModel
      .find({ group: group._id, period })
      .select('user')
      .lean();
    const memberIds = new Set(members.map((member) => member.user.toString()));

    return new Set(
      paid
        .map((donation) => donation.user.toString())
        .filter((userId) => memberIds.has(userId)),
    );
  }

  /**
   * Where the pool stands on termination for the given viewer: their own
   * vote, the 100%-paid electorate, the yes votes, the 2/3 threshold and
   * whether every naira donated has already been paid out.
   *
   * Votes that no longer qualify (the voter fell behind on a recurring pool)
   * are ignored rather than deleted, so catching up restores the vote.
   */
  private async terminationStanding(
    group: DonationGroupDocument,
    userId: string,
    now: Date = new Date(),
  ): Promise<DonationTerminationStanding> {
    const eligibleIds = await this.fullyPaidUserIds(group, now);
    const votes = (group.terminationVotes ?? []).filter((voterId) =>
      eligibleIds.has(voterId.toString()),
    );
    const requiredVotes =
      eligibleIds.size === 0
        ? 0
        : Math.ceil(
            (eligibleIds.size * DONATION_TERMINATION_VOTE_NUMERATOR) /
              DONATION_TERMINATION_VOTE_DENOMINATOR,
          );
    const terminated = group.status === DonationGroupStatus.TERMINATED;
    const totalCollected = group.totalCollected ?? 0;
    const totalPaidOut = group.totalPaidOut ?? 0;
    const votesMet = requiredVotes > 0 && votes.length >= requiredVotes;
    // Every naira donated has been paid out — the pool has served its purpose.
    const fundsUtilized = totalPaidOut === totalCollected;

    return {
      myVote: votes.some((voterId) => voterId.toString() === userId),
      eligible: eligibleIds.has(userId),
      eligibleCount: eligibleIds.size,
      votes: votes.length,
      requiredVotes,
      votesMet,
      totalCollected,
      totalPaidOut,
      fundsUtilized,
      canTerminate: !terminated && votesMet && fundsUtilized,
      terminated,
      percentVoted:
        eligibleIds.size === 0
          ? 0
          : Math.round((votes.length / eligibleIds.size) * 100),
    };
  }

  /**
   * Resolves the members a termination notice has to reach. Called before
   * the pool is purged — the memberships it reads are deleted with it.
   */
  private async poolTerminationNotice(group: DonationGroupDocument): Promise<{
    userIds: string[];
    poolName: string;
    phones?: Map<string, string>;
  }> {
    const members = await this.donationMemberModel
      .find({ group: group._id })
      .select('user')
      .lean();
    const userIds = members.map((member) => member.user.toString());

    const users =
      members.length > 0
        ? await this.usersService.findByIds(
            members.map((member) => member.user),
          )
        : [];
    const phones = new Map(
      users
        .filter((user) => Boolean(user.phone))
        .map((user) => [user._id.toString(), user.phone]),
    );

    return {
      userIds,
      poolName: group.name,
      phones: phones.size > 0 ? phones : undefined,
    };
  }

  private sendPoolTerminatedNotice(notice: {
    userIds: string[];
    poolName: string;
    phones?: Map<string, string>;
  }): void {
    if (notice.userIds.length === 0) return;
    void this.notificationsService.send(
      NotificationEvents.donationPoolTerminated(notice),
    );
  }

  // ---- Pool creation / membership ------------------------------------------

  /**
   * Creates a pool plus the admin's membership in one transaction.
   *
   * `joinCode` is unique; on the (astronomically unlikely) collision Mongo
   * aborts the transaction with E11000 and the whole thing is retried with a
   * fresh code — the same approach `GroupsService.createGroup` uses.
   */
  async createGroup(userId: string, dto: CreateDonationGroupDto) {
    if (dto.amountType === DonationAmountType.FIXED) {
      if (dto.amount === undefined) {
        throw new BadRequestException(
          'Enter the fixed amount members should donate.',
        );
      }
      if (dto.amount < DONATION_MIN_AMOUNT) {
        throw new BadRequestException(
          `The minimum donation amount is ₦${DONATION_MIN_AMOUNT}.`,
        );
      }
    }

    if (dto.schedule === DonationSchedule.INTERVAL && !dto.frequency) {
      throw new BadRequestException(
        'Choose how often members can donate (daily, weekly, monthly or yearly).',
      );
    }

    const session = await this.connection.startSession();
    let group: DonationGroupDocument | undefined;
    let lastError: unknown;

    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await session.withTransaction(async () => {
            const [created] = await this.donationGroupModel.create(
              [
                {
                  name: dto.name.trim(),
                  purpose: dto.purpose.trim(),
                  amountType: dto.amountType,
                  amount:
                    dto.amountType === DonationAmountType.FIXED
                      ? dto.amount
                      : undefined,
                  schedule: dto.schedule,
                  frequency:
                    dto.schedule === DonationSchedule.INTERVAL
                      ? dto.frequency
                      : undefined,
                  joinCode: generateJoinCode(),
                  admin: new Types.ObjectId(userId),
                  status: DonationGroupStatus.ACTIVE,
                  escrowBalance: 0,
                  totalCollected: 0,
                  totalPaidOut: 0,
                  memberCount: 1,
                  donorCount: 0,
                },
              ],
              { session },
            );

            await this.donationMemberModel.create(
              [
                {
                  group: created._id,
                  user: new Types.ObjectId(userId),
                  totalDonated: 0,
                  donationCount: 0,
                  joinedAt: new Date(),
                },
              ],
              { session },
            );

            group = created;
          });
          break;
        } catch (error) {
          lastError = error;
          if (!this.isDuplicateKeyError(error)) {
            throw error;
          }
          this.logger.warn(
            'Donation pool join code collision — retrying with a new code.',
          );
        }
      }

      if (!group) {
        throw lastError instanceof Error
          ? lastError
          : new InternalServerErrorException(
              'Could not create the pool. Please try again.',
            );
      }
    } finally {
      await session.endSession();
    }

    return this.getGroup(userId, group._id.toString());
  }

  /**
   * Joins a pool by its shared Group ID. Joining twice is a no-op rather than
   * an error, so a member who taps "Join" again (or retries after a flaky
   * network) simply lands back in the pool.
   */
  async joinGroup(userId: string, groupIdOrCode: string) {
    const code = normalizeJoinCode(groupIdOrCode);
    if (!code) {
      throw new BadRequestException('Enter the Group ID to join a pool.');
    }

    let group = await this.donationGroupModel.findOne({ joinCode: code });
    if (!group && Types.ObjectId.isValid(code)) {
      group = await this.donationGroupModel.findById(code);
    }
    if (!group) {
      throw new NotFoundException('No pool found with that Group ID.');
    }

    if (group.status !== DonationGroupStatus.ACTIVE) {
      throw new BadRequestException(
        'This pool is no longer accepting new members.',
      );
    }

    const { created } = await this.findOrCreateMembership(group._id, userId);

    if (created) {
      await this.donationGroupModel.updateOne(
        { _id: group._id },
        { $inc: { memberCount: 1 } },
      );

      const [joiner, admin] = await Promise.all([
        this.usersService.findById(userId),
        this.usersService.findById(group.admin.toString()),
      ]);
      const adminId = group.admin.toString();
      void this.notificationsService.send(
        NotificationEvents.donationMemberJoined({
          userIds: [adminId],
          memberName: joiner?.name?.trim() || joiner?.phone || 'A new member',
          poolName: group.name,
          phones: admin?.phone ? new Map([[adminId, admin.phone]]) : undefined,
        }),
      );
    }

    return this.getGroup(userId, group._id.toString());
  }

  /**
   * Every pool the caller belongs to, newest first, plus the dashboard
   * totals the list screen shows at the top. The caller's own donation state
   * for the current window is resolved in one batched query.
   */
  async listGroups(userId: string) {
    const memberships = await this.donationMemberModel
      .find({ user: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();

    if (memberships.length === 0) {
      return {
        groups: [],
        stats: {
          poolCount: 0,
          totalDonated: 0,
          totalRaised: 0,
          totalPaidOut: 0,
          activePoolCount: 0,
        },
      };
    }

    const groupIds = memberships.map((membership) => membership.group);
    const groupDocs = await this.donationGroupModel
      // Terminating a pool deletes it, so a `terminated` row is legacy data
      // `npm run seed:purge-terminated-pools` cleans up — never a card.
      .find({
        _id: { $in: groupIds },
        status: { $ne: DonationGroupStatus.TERMINATED },
      })
      .sort({ createdAt: -1 })
      .lean();
    const byGroupId = new Map(
      memberships.map((membership) => [
        membership.group.toString(),
        membership,
      ]),
    );

    const now = new Date();
    const windowFilters = groupDocs.map((group) => ({
      group: group._id,
      period: currentPeriodKey(group.schedule, group.frequency, now),
    }));
    const donated =
      windowFilters.length > 0
        ? await this.donationModel
            .find({ user: new Types.ObjectId(userId), $or: windowFilters })
            .select('group period')
            .lean()
        : [];
    const donatedKeys = new Set(
      donated.map((row) => `${row.group.toString()}|${row.period}`),
    );

    const groups = groupDocs.map((group) => {
      const membership = byGroupId.get(group._id.toString());
      const isAdmin = group.admin.toString() === userId;
      const period = currentPeriodKey(group.schedule, group.frequency, now);
      const alreadyDonated = donatedKeys.has(
        `${group._id.toString()}|${period}`,
      );

      return {
        ...group,
        // The payout override is admin-only information.
        ...(isAdmin ? {} : { payoutAccount: undefined }),
        // Raw voter ids stay server-side; the detail screen shows the tally.
        terminationVotes: undefined,
        isAdmin,
        role: isAdmin ? 'admin' : 'member',
        myTotalDonated: membership?.totalDonated ?? 0,
        myDonationCount: membership?.donationCount ?? 0,
        joinedAt: membership?.joinedAt,
        period,
        alreadyDonated,
        canDonate:
          group.status === DonationGroupStatus.ACTIVE && !alreadyDonated,
        nextDonationAt:
          group.schedule === DonationSchedule.INTERVAL && group.frequency
            ? nextPeriodStart(group.frequency, now)
            : null,
      };
    });

    const adminGroups = groupDocs.filter(
      (group) => group.admin.toString() === userId,
    );

    return {
      groups,
      stats: {
        poolCount: groups.length,
        totalDonated: groups.reduce(
          (sum, group) => sum + (group.myTotalDonated ?? 0),
          0,
        ),
        totalRaised: adminGroups.reduce(
          (sum, group) => sum + (group.totalCollected ?? 0),
          0,
        ),
        totalPaidOut: adminGroups.reduce(
          (sum, group) => sum + (group.totalPaidOut ?? 0),
          0,
        ),
        activePoolCount: groups.filter(
          (group) => group.status === DonationGroupStatus.ACTIVE,
        ).length,
      },
    };
  }

  // ---- Pool detail / history ------------------------------------------------

  /**
   * Pool detail for a member: totals, their own giving, whether they can
   * donate right now (and when the window reopens), the latest donations and
   * — for the admin only — where a payout would land. The payout override is
   * stripped for regular members.
   */
  async getGroup(userId: string, groupId: string) {
    const group = await this.requireGroup(groupId);
    const membership = await this.requireMembership(group._id, userId);
    const isAdmin = group.admin.toString() === userId;
    const window = await this.describeDonationWindow(group, userId);

    const recentRows = await this.donationModel
      .find({ group: group._id })
      .sort({ createdAt: -1 })
      .limit(DONATION_RECENT_LIMIT)
      .lean();
    const recentDonations = await this.withDonorNames(recentRows);

    const groupView = group.toObject() as Record<string, unknown>;
    if (!isAdmin) {
      delete groupView.payoutAccount;
    }
    // Raw voter ids stay server-side; the tally is exposed as `termination`.
    delete groupView.terminationVotes;

    return {
      group: groupView,
      membership: {
        joinedAt: membership.joinedAt,
        totalDonated: membership.totalDonated,
        donationCount: membership.donationCount,
        lastDonatedAt: membership.lastDonatedAt,
      },
      isAdmin,
      role: isAdmin ? 'admin' : 'member',
      donationWindowLabel: this.windowLabel(group),
      termination: await this.terminationStanding(group, userId),
      ...window,
      recentDonations,
      payoutDestination: isAdmin
        ? await this.resolvePayoutDestination(group)
        : null,
    };
  }

  /**
   * Paginated donor history for a pool, newest first. Visible to every
   * member — transparency is the point of a cooperative pool. Out-of-range
   * pages clamp to the last page instead of returning an empty list.
   */
  async listDonations(
    userId: string,
    groupId: string,
    query: ListDonationsQueryDto,
  ) {
    const group = await this.requireGroup(groupId);
    await this.requireMembership(group._id, userId);

    const { limit, requestedPage } = this.paging(query);
    const total = await this.donationModel.countDocuments({ group: group._id });
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pageCount);

    const rows = await this.donationModel
      .find({ group: group._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      donations: await this.withDonorNames(rows),
      page,
      limit,
      total,
      totalPages: pageCount,
      totalCollected: group.totalCollected,
    };
  }

  // ---- Donating -------------------------------------------------------------

  /**
   * Resolves the amount a donation should move:
   *   FIXED     -> always the pool's amount (a mismatching client value is
   *                rejected rather than silently ignored).
   *   FREE_WILL -> whatever the donor entered, at least DONATION_MIN_AMOUNT.
   */
  private resolveDonationAmount(
    group: DonationGroupDocument,
    dto: DonateDto,
  ): number {
    if (group.amountType === DonationAmountType.FIXED) {
      if (!group.amount) {
        throw new BadRequestException(
          'This pool has no donation amount configured.',
        );
      }
      if (dto.amount !== undefined && dto.amount !== group.amount) {
        throw new BadRequestException(
          `This pool only accepts ₦${group.amount.toLocaleString()} per donation.`,
        );
      }
      return group.amount;
    }

    if (dto.amount === undefined) {
      throw new BadRequestException('Enter the amount you want to donate.');
    }
    if (dto.amount < DONATION_MIN_AMOUNT) {
      throw new BadRequestException(
        `The minimum donation amount is ₦${DONATION_MIN_AMOUNT}.`,
      );
    }
    return dto.amount;
  }

  /**
   * Donates into a pool from the caller's wallet.
   *
   * Flow, all inside one Mongo transaction so the books always balance:
   *   1. write the Donation row — its unique {group,user,period} index and
   *      deterministic reference are the idempotency guards, so a double tap
   *      aborts here before any money moves;
   *   2. debit the wallet (`debitForDonation`, unique per reference);
   *   3. bump the member's totals (+ donorCount on their first donation);
   *   4. credit the pool escrow and write the escrow ledger row.
   *
   * A duplicate request is treated as success and simply returns the current
   * pool state — the same behaviour as `SavingsService.payInterval`.
   */
  async donate(userId: string, groupId: string, dto: DonateDto) {
    const group = await this.requireGroup(groupId);
    const membership = await this.requireMembership(group._id, userId);

    if (group.status !== DonationGroupStatus.ACTIVE) {
      throw new BadRequestException(
        'This pool is no longer accepting donations.',
      );
    }

    const amount = this.resolveDonationAmount(group, dto);
    const now = new Date();
    const period = currentPeriodKey(group.schedule, group.frequency, now);
    const userObjectId = new Types.ObjectId(userId);
    const reference = `don_${group._id.toString()}_${userId}_${period}`;

    // The platform charges its wallet -> escrow transfer fee on top of the
    // donation: `amount` funds the pool, `serviceFee` goes to the platform
    // admin's wallet. Read at transfer time so a rate change applies at once.
    const serviceFee =
      await this.platformSettings.calculateEscrowTransferFee(amount);
    const platformAdmin =
      serviceFee > 0 ? await this.usersService.findPlatformAdmin() : null;

    let escrowBalance = 0;
    let totalCollected = 0;

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const [donation] = await this.donationModel.create(
          [
            {
              group: group._id,
              member: membership._id,
              user: userObjectId,
              amount,
              serviceFee,
              period,
              reference,
            },
          ],
          { session },
        );

        const debited = await this.walletService.debitForDonation(
          userObjectId,
          amount,
          { donationGroup: group._id },
          reference,
          session,
          serviceFee,
        );

        if (!debited) {
          // Rolls the Donation row back too, so an unpaid attempt never
          // shows up in the donor history.
          const required = amount + serviceFee;
          throw new BadRequestException(
            serviceFee > 0
              ? `Insufficient wallet balance. You need ₦${required.toLocaleString()} (donation ₦${amount.toLocaleString()} + service fee ₦${serviceFee.toLocaleString()}). Top up your wallet and try again.`
              : 'Insufficient wallet balance. Top up your wallet and try again.',
          );
        }

        if (platformAdmin && serviceFee > 0) {
          await this.walletService.creditServiceFee(
            platformAdmin._id.toString(),
            serviceFee,
            {},
            session,
            {
              reference: `${reference}_fee`,
              metadata: {
                source: 'donation_transfer_fee',
                donationGroup: group._id.toString(),
                donation: donation._id.toString(),
              },
            },
          );
        }

        const memberDoc = await this.donationMemberModel
          .findById(membership._id)
          .session(session);
        if (!memberDoc) {
          throw new NotFoundException('Pool membership not found.');
        }
        const firstDonation = memberDoc.donationCount === 0;

        memberDoc.totalDonated += amount;
        memberDoc.donationCount += 1;
        memberDoc.lastDonatedAt = now;
        await memberDoc.save({ session });

        const updatedGroup = await this.donationGroupModel.findByIdAndUpdate(
          group._id,
          {
            $inc: {
              escrowBalance: amount,
              totalCollected: amount,
              donorCount: firstDonation ? 1 : 0,
            },
            $set: { lastDonationAt: now },
          },
          { new: true, session },
        );
        if (!updatedGroup) {
          throw new NotFoundException('Pool not found');
        }

        escrowBalance = updatedGroup.escrowBalance;
        totalCollected = updatedGroup.totalCollected;

        await this.escrowTxModel.create(
          [
            {
              group: group._id,
              type: DonationEscrowTransactionType.DONATION_CREDIT,
              amount,
              balanceBefore: escrowBalance - amount,
              balanceAfter: escrowBalance,
              donation: donation._id,
              reference,
              metadata: { userId, period },
            },
          ],
          { session },
        );
      });
    } catch (err) {
      if (this.isDuplicateKeyError(err)) {
        this.logger.warn(
          `Donation already recorded (${reference}); ignoring duplicate request.`,
        );
        return this.getGroup(userId, groupId);
      }
      throw err;
    } finally {
      await session.endSession();
    }

    const [donor, adminUser] = await Promise.all([
      this.usersService.findById(userId),
      group.admin.toString() === userId
        ? Promise.resolve(null)
        : this.usersService.findById(group.admin.toString()),
    ]);

    void this.notificationsService.send(
      NotificationEvents.donationReceived({
        userIds: [userId],
        poolName: group.name,
        amount,
        windowLabel: this.windowLabel(group),
        escrowBalance,
        phones: donor?.phone ? new Map([[userId, donor.phone]]) : undefined,
      }),
    );

    if (adminUser) {
      const adminId = group.admin.toString();
      void this.notificationsService.send(
        NotificationEvents.donationReceivedAdmin({
          userIds: [adminId],
          donorName: donor?.name?.trim() || donor?.phone || 'A member',
          poolName: group.name,
          amount,
          totalCollected,
          phones: adminUser.phone
            ? new Map([[adminId, adminUser.phone]])
            : undefined,
        }),
      );
    }

    return this.getGroup(userId, groupId);
  }

  // ---- Termination by member vote -------------------------------------------

  /**
   * Casts (or withdraws) the caller's vote for the pool to be terminated.
   *
   * Only members who have made 100% of their payment towards the pool may
   * vote — they are the electorate the 2/3 threshold is measured against.
   * Voting again with the same value is a no-op ($addToSet / $pull).
   */
  async voteOnTermination(userId: string, groupId: string, vote: boolean) {
    const group = await this.requireGroup(groupId);
    await this.requireMembership(group._id, userId);

    if (group.status === DonationGroupStatus.TERMINATED) {
      throw new BadRequestException('This pool has already been terminated.');
    }

    const voterId = new Types.ObjectId(userId);
    const standing = await this.terminationStanding(group, userId);
    if (!standing.eligible) {
      throw new BadRequestException(
        'Only members who have made 100% of their payment towards this pool can vote on termination.',
      );
    }

    await this.donationGroupModel.updateOne(
      { _id: group._id },
      vote
        ? { $addToSet: { terminationVotes: voterId } }
        : { $pull: { terminationVotes: voterId } },
    );

    return this.getGroup(userId, groupId);
  }

  /**
   * Terminates the pool. Admin-only, and only once BOTH conditions hold:
   * 2/3 of the fully paid members voted yes, and everything donated has been
   * paid out (`totalPaidOut === totalCollected`) so no money is stranded in
   * the pool. Both are re-checked here so a stale screen can never end a pool
   * the vote/funds do not support.
   */
  async terminateGroup(
    userId: string,
    groupId: string,
  ): Promise<DonationPoolTermination> {
    const group = await this.requireAdmin(groupId, userId);

    const standing = await this.terminationStanding(group, userId);
    if (!standing.votesMet) {
      throw new BadRequestException(
        `Termination needs 2/3 of the fully paid members to vote yes ` +
          `(${standing.votes} of ${standing.requiredVotes} votes so far).`,
      );
    }

    if (!standing.fundsUtilized) {
      const outstanding = standing.totalCollected - standing.totalPaidOut;
      throw new BadRequestException(
        `Pay out the rest of the pool first: ` +
          `₦${outstanding.toLocaleString()} of the ` +
          `₦${standing.totalCollected.toLocaleString()} donated has not ` +
          `been paid out yet.`,
      );
    }

    // The members have to be resolved before the rows are deleted — after the
    // purge there is no membership left to look recipients up from.
    const notice = await this.poolTerminationNotice(group);
    await this.purgeGroup(group._id);
    this.sendPoolTerminatedNotice(notice);

    return {
      groupId: group._id.toString(),
      status: DonationGroupStatus.TERMINATED,
    };
  }

  /**
   * Deletes a pool and every record scoped to it — donations, memberships,
   * payouts, escrow movements and the pool itself — in one Mongo transaction.
   * Donors' personal `WalletTransaction` history is kept.
   *
   * Terminating a pool is irreversible and frees the space rather than
   * leaving a `terminated` row behind, so no list, search or notification can
   * ever surface it again.
   */
  async purgeGroup(groupId: Types.ObjectId): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.escrowTxModel.deleteMany({ group: groupId }, { session });
        await this.donationPayoutModel.deleteMany(
          { group: groupId },
          { session },
        );
        await this.donationModel.deleteMany({ group: groupId }, { session });
        await this.donationMemberModel.deleteMany(
          { group: groupId },
          { session },
        );
        await this.donationGroupModel.deleteOne({ _id: groupId }, { session });
      });
    } finally {
      await session.endSession();
    }
  }

  /**
   * One-off cleanup for pools terminated before terminating deleted them:
   * those rows are still `status: 'terminated'`. They are invisible to the
   * app but still hold donations, memberships, payouts and escrow movements.
   *
   * Purges them exactly like live termination. A pool whose escrow still
   * holds money is skipped and reported — that money belongs to the members
   * and has to be paid out first, the same rule live termination enforces.
   */
  async purgeTerminatedPools(
    options: { dryRun?: boolean } = {},
  ): Promise<DonationPoolPurgeResult> {
    const dryRun = options.dryRun ?? true;
    const pools = await this.donationGroupModel
      .find({ status: DonationGroupStatus.TERMINATED })
      .select('name escrowBalance')
      .lean();

    const result: DonationPoolPurgeResult = {
      scanned: pools.length,
      purged: [],
      skipped: [],
    };

    for (const pool of pools) {
      const id = pool._id.toString();
      const name = pool.name;
      const balance = pool.escrowBalance ?? 0;

      if (balance > 0) {
        result.skipped.push({ id, name, balance });
        continue;
      }

      if (!dryRun) {
        await this.purgeGroup(pool._id);
      }
      result.purged.push({ id, name });
    }

    return result;
  }

  // ---- Payout destination (admin) -------------------------------------------

  /**
   * Current payout setup for the pool admin: the pool-level override (if any),
   * the admin's own saved account, and the account a payout would actually use.
   */
  async getPayoutAccount(userId: string, groupId: string) {
    const group = await this.requireAdmin(groupId, userId);
    const admin = await this.usersService.findById(userId);

    return {
      poolAccount: group.payoutAccount ?? null,
      adminAccount: admin?.bankAccount ?? null,
      destination: await this.resolvePayoutDestination(group),
    };
  }

  /**
   * Sets (or clears) the pool's payout destination.
   *
   * `{ useAdminAccount: true }` removes the override so the admin's saved
   * bank account is used. Otherwise the NUBAN is resolved through Paystack
   * (which also proves the account exists and yields the real account name)
   * and a transfer recipient is created.
   */
  async setPayoutAccount(
    userId: string,
    groupId: string,
    dto: SetDonationPayoutAccountDto,
  ) {
    const group = await this.requireAdmin(groupId, userId);

    if (dto.useAdminAccount) {
      const admin = await this.usersService.findById(userId);
      if (!admin?.bankAccount?.paystackRecipientCode) {
        throw new BadRequestException(
          'Add a bank account to your wallet before using it for payouts.',
        );
      }
      group.payoutAccount = undefined;
      await group.save();
      return this.getPayoutAccount(userId, groupId);
    }

    const { bankCode, bankName, accountNumber } = dto;
    if (!bankCode || !bankName || !accountNumber) {
      throw new BadRequestException(
        'Choose a bank and enter the 10-digit account number.',
      );
    }

    const resolved = await this.paystack.resolveAccountNumber(
      accountNumber,
      bankCode,
    );
    const recipient = await this.paystack.createTransferRecipient({
      accountNumber: resolved.accountNumber,
      bankCode,
      accountName: resolved.accountName,
    });

    group.payoutAccount = {
      bankCode,
      bankName,
      accountNumber: resolved.accountNumber,
      accountName: resolved.accountName,
      paystackRecipientCode: recipient.recipientCode,
    };
    await group.save();

    return this.getPayoutAccount(userId, groupId);
  }

  // ---- Payouts (admin) ------------------------------------------------------

  /** Paginated payout history for the admin, newest first. */
  async listPayouts(
    userId: string,
    groupId: string,
    query: ListDonationsQueryDto,
  ) {
    const group = await this.requireAdmin(groupId, userId);

    const { limit, requestedPage } = this.paging(query);
    const total = await this.donationPayoutModel.countDocuments({
      group: group._id,
    });
    const pageCount = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pageCount);

    const payouts = await this.donationPayoutModel
      .find({ group: group._id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return {
      payouts,
      page,
      limit,
      total,
      totalPages: pageCount,
      escrowBalance: group.escrowBalance,
      totalPaidOut: group.totalPaidOut,
      totalCollected: group.totalCollected,
      destination: await this.resolvePayoutDestination(group),
    };
  }

  /**
   * Pays escrow out to the admin's bank account.
   *
   * Mirrors `CyclesService.initiatePayout`:
   *   1. atomically reserve the amount by decrementing `escrowBalance` with a
   *      `$gte` guard (so two admins/taps can never overdraw the pool) and
   *      record the PENDING payout + escrow ledger row in one transaction;
   *   2. call Paystack *outside* the transaction (network call, must not hold
   *      a lock);
   *   3. finalize inline when the transfer is already successful (or when
   *      test-mode OTP resolution succeeds), otherwise leave it PENDING for
   *      the `transfer.success` webhook;
   *   4. on any error, release the reserved funds back into escrow.
   *
   * `amount` omitted => withdraw the whole escrow balance.
   */
  async initiatePayout(
    userId: string,
    groupId: string,
    dto: CreateDonationPayoutDto,
  ) {
    const group = await this.requireAdmin(groupId, userId);
    const destination = await this.resolvePayoutDestination(group);

    if (!destination) {
      throw new BadRequestException(
        'Add a payout bank account first — save one on your wallet or choose one for this pool.',
      );
    }

    if (group.escrowBalance < DONATION_PAYOUT_MIN_AMOUNT) {
      throw new BadRequestException('There is nothing to pay out yet.');
    }

    const amount = dto.amount ?? group.escrowBalance;
    if (amount < DONATION_PAYOUT_MIN_AMOUNT) {
      throw new BadRequestException(
        `The minimum payout is ₦${DONATION_PAYOUT_MIN_AMOUNT.toLocaleString()}.`,
      );
    }
    if (amount > group.escrowBalance) {
      throw new BadRequestException(
        'The payout amount is more than the pool balance.',
      );
    }

    // Platform payout charge: a percentage of the amount leaving escrow,
    // credited to the platform admin's wallet once the transfer succeeds.
    // Escrow is debited the full amount; the admin receives `netAmount`.
    const fee = await this.platformSettings.calculatePayoutFee(amount);
    const netAmount = amount - fee;

    if (netAmount <= 0) {
      throw new BadRequestException(
        `The ₦${amount.toLocaleString()} payout doesn't cover the ₦${fee.toLocaleString()} platform payout fee.`,
      );
    }

    // A fresh random reference per attempt: Paystack treats a reference as
    // used forever, so a deterministic one would fail on retry.
    const reference = `donation_payout_${group._id.toString()}_${randomUUID()}`;

    let payout: DonationPayoutDocument | undefined;
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const reserved = await this.donationGroupModel.findOneAndUpdate(
          { _id: group._id, escrowBalance: { $gte: amount } },
          { $inc: { escrowBalance: -amount } },
          { new: true, session },
        );
        if (!reserved) {
          throw new BadRequestException(
            'The pool balance changed while preparing this payout. Refresh and try again.',
          );
        }

        const [created] = await this.donationPayoutModel.create(
          [
            {
              group: group._id,
              initiatedBy: new Types.ObjectId(userId),
              amount,
              fee,
              netAmount,
              status: TransferStatus.PENDING,
              paystackReference: reference,
              bankName: destination.bankName,
              accountNumber: destination.accountNumber,
              accountName: destination.accountName,
            },
          ],
          { session },
        );

        await this.escrowTxModel.create(
          [
            {
              group: group._id,
              type: DonationEscrowTransactionType.PAYOUT_DEBIT,
              amount,
              balanceBefore: reserved.escrowBalance + amount,
              balanceAfter: reserved.escrowBalance,
              payout: created._id,
              reference,
              metadata: { destination: destination.source },
            },
          ],
          { session },
        );

        payout = created;
      });
    } finally {
      await session.endSession();
    }

    const pendingPayout = payout;
    if (!pendingPayout) {
      throw new InternalServerErrorException(
        'Could not start the payout. Please try again.',
      );
    }

    try {
      const transfer = await this.paystack.initiateTransfer({
        amountNaira: netAmount,
        recipientCode: destination.paystackRecipientCode,
        reason: `Ajo pool payout – ${group.name}`,
        reference,
      });

      await this.donationPayoutModel.updateOne(
        { _id: pendingPayout._id },
        { $set: { paystackTransferCode: transfer.transferCode } },
      );

      if (transfer.status === 'success') {
        await this.completePayout(reference);
      } else if (transfer.status === 'otp' && this.paystack.isTestMode()) {
        this.logger.log(
          `Test mode: resolving OTP for pool payout ${transfer.transferCode}`,
        );
        await this.paystack.resolveOtp(
          transfer.transferCode,
          this.paystack.testTransferOtp(),
        );
        await this.completePayout(reference);
      } else if (transfer.status === 'failed') {
        // Paystack rejected it outright — nothing will finalize later, so
        // release the escrow now rather than waiting for a webhook.
        throw new InternalServerErrorException(
          'Paystack rejected the transfer (status: failed).',
        );
      }
      // 'pending' or live-mode 'otp' -> the webhook finalizes it.
    } catch (err) {
      this.logger.error(
        `Paystack payout failed for pool ${group._id.toString()}: ${String(err)}`,
      );
      if (this.paystack.isTestMode()) {
        this.logger.error(
          'Pool payout failed in test mode. If Paystack asked for an OTP, set PAYSTACK_TRANSFER_OTP to the code sent to the dashboard account (default is 123456).',
        );
      }
      await this.failPayout(reference, String(err));
      throw new InternalServerErrorException(
        'Payout failed. The money is still in the pool — please try again.',
      );
    }

    const [freshPayout, freshGroup] = await Promise.all([
      this.donationPayoutModel.findById(pendingPayout._id),
      this.donationGroupModel.findById(group._id),
    ]);

    return { payout: freshPayout, group: freshGroup, destination };
  }

  /**
   * Finalizes a successful payout — called inline for immediate transfers and
   * from the `transfer.success` webhook otherwise.
   *
   * Idempotent: a payout that is not PENDING is left untouched, so an inline
   * success racing the webhook can only credit `totalPaidOut` once.
   *
   * @returns `true` when this reference belongs to a pool payout, so the
   * webhook can stop falling through to other transfer handlers.
   */
  async completePayout(reference: string): Promise<boolean> {
    const payout = await this.donationPayoutModel.findOne({
      paystackReference: reference,
    });
    if (!payout) return false;
    if (payout.status !== TransferStatus.PENDING) return true;

    // Recognise the platform's payout charge only once the transfer
    // succeeded. Read the platform admin before opening the transaction.
    const payoutFee = payout.fee ?? 0;
    const platformAdmin =
      payoutFee > 0 ? await this.usersService.findPlatformAdmin() : null;

    const session = await this.connection.startSession();
    let claimed = false;
    try {
      await session.withTransaction(async () => {
        const updated = await this.donationPayoutModel.findOneAndUpdate(
          { _id: payout._id, status: TransferStatus.PENDING },
          {
            $set: {
              status: TransferStatus.SUCCESS,
              completedAt: new Date(),
            },
          },
          { new: true, session },
        );
        if (!updated) return;
        claimed = true;

        await this.donationGroupModel.updateOne(
          { _id: payout.group },
          {
            $inc: { totalPaidOut: payout.amount },
            $set: { lastPayoutAt: new Date() },
          },
          { session },
        );

        if (platformAdmin && payoutFee > 0) {
          await this.walletService.creditServiceFee(
            platformAdmin._id.toString(),
            payoutFee,
            {},
            session,
            {
              reference: `payout_fee_${payout._id.toString()}`,
              metadata: {
                source: 'donation_payout_fee',
                donationGroup: payout.group.toString(),
                payout: payout._id.toString(),
                grossAmount: payout.amount,
              },
            },
          );
        }
      });
    } finally {
      await session.endSession();
    }

    if (claimed) {
      await this.notifyPayoutSuccess(payout);
    }
    return true;
  }

  /**
   * Handles `transfer.failed`: releases the reserved escrow back into the
   * pool and marks the payout FAILED. Returns `true` when the reference is a
   * pool payout (even if it had already been finalized).
   */
  async failPayout(reference: string, reason?: string): Promise<boolean> {
    const payout = await this.donationPayoutModel.findOne({
      paystackReference: reference,
    });
    if (!payout) return false;

    const refunded = await this.refundEscrow(
      payout,
      TransferStatus.FAILED,
      reason,
    );
    if (refunded) {
      await this.notifyPayoutOutcome(payout, 'failed', reason);
    }
    return true;
  }

  /**
   * Handles `transfer.reversed`: the money came back, so escrow is re-credited
   * and `totalPaidOut` is rolled back when the transfer had been successful.
   */
  async reversePayout(reference: string): Promise<boolean> {
    const payout = await this.donationPayoutModel.findOne({
      paystackReference: reference,
    });
    if (!payout) return false;

    const refunded = await this.refundEscrow(
      payout,
      TransferStatus.REVERSED,
      'Transfer reversed by the bank',
    );
    if (refunded) {
      await this.notifyPayoutOutcome(payout, 'reversed');
    }
    return true;
  }

  /**
   * Moves a payout to a terminal "money returned" status and credits the
   * amount back to the pool escrow — all in one transaction.
   *
   * Only PENDING or SUCCESS payouts can be refunded; the conditional update
   * makes a duplicate webhook delivery a no-op, so escrow is never credited
   * twice.
   */
  private async refundEscrow(
    payout: DonationPayoutDocument,
    status: TransferStatus.FAILED | TransferStatus.REVERSED,
    reason?: string,
  ): Promise<boolean> {
    const wasSuccessful = payout.status === TransferStatus.SUCCESS;
    // The platform fee is only credited once the transfer succeeded, so a
    // reversal of an already-SUCCESS payout must claw it back too.
    const payoutFee = payout.fee ?? 0;
    const feeWasCredited = wasSuccessful && payoutFee > 0;
    const platformAdmin = feeWasCredited
      ? await this.usersService.findPlatformAdmin()
      : null;
    const session = await this.connection.startSession();
    let refunded = false;

    try {
      await session.withTransaction(async () => {
        const updated = await this.donationPayoutModel.findOneAndUpdate(
          {
            _id: payout._id,
            status: { $in: [TransferStatus.PENDING, TransferStatus.SUCCESS] },
          },
          {
            $set: {
              status,
              failureReason: reason,
              completedAt: new Date(),
            },
          },
          { new: true, session },
        );
        if (!updated) return;

        const group = await this.donationGroupModel.findByIdAndUpdate(
          payout.group,
          {
            $inc: {
              escrowBalance: payout.amount,
              ...(wasSuccessful ? { totalPaidOut: -payout.amount } : {}),
            },
          },
          { new: true, session },
        );
        if (!group) return;

        refunded = true;

        if (platformAdmin && feeWasCredited) {
          await this.walletService.reverseServiceFeeCredit(
            platformAdmin._id.toString(),
            payoutFee,
            {},
            session,
            {
              reference: `payout_fee_reversal_${payout._id.toString()}`,
              metadata: {
                source: 'donation_payout_fee_reversal',
                donationGroup: payout.group.toString(),
                payout: payout._id.toString(),
              },
            },
          );
        }

        await this.escrowTxModel.create(
          [
            {
              group: payout.group,
              type: DonationEscrowTransactionType.PAYOUT_REVERSAL_CREDIT,
              amount: payout.amount,
              balanceBefore: group.escrowBalance - payout.amount,
              balanceAfter: group.escrowBalance,
              payout: payout._id,
              reference: `${payout.paystackReference}_reversal`,
              metadata: { reason },
            },
          ],
          { session },
        );
      });
    } finally {
      await session.endSession();
    }

    return refunded;
  }

  /** Notifies the admin that a payout landed. Best-effort, never throws. */
  private async notifyPayoutSuccess(
    payout: DonationPayoutDocument,
  ): Promise<void> {
    const adminId = payout.initiatedBy.toString();
    const [group, admin] = await Promise.all([
      this.donationGroupModel.findById(payout.group).select('name').lean(),
      this.usersService.findById(adminId),
    ]);

    void this.notificationsService.send(
      NotificationEvents.donationPayoutSuccess({
        userIds: [adminId],
        poolName: group?.name ?? 'your pool',
        amount: payout.netAmount || payout.amount,
        fee: payout.fee ?? 0,
        bankName: payout.bankName,
        accountNumber: payout.accountNumber,
        phones: admin?.phone ? new Map([[adminId, admin.phone]]) : undefined,
      }),
    );
  }

  /** Notifies the admin that a payout failed or was reversed. */
  private async notifyPayoutOutcome(
    payout: DonationPayoutDocument,
    outcome: 'failed' | 'reversed',
    reason?: string,
  ): Promise<void> {
    const adminId = payout.initiatedBy.toString();
    const [group, admin] = await Promise.all([
      this.donationGroupModel.findById(payout.group).select('name').lean(),
      this.usersService.findById(adminId),
    ]);
    const poolName = group?.name ?? 'your pool';
    const phones = admin?.phone ? new Map([[adminId, admin.phone]]) : undefined;

    void this.notificationsService.send(
      outcome === 'failed'
        ? NotificationEvents.donationPayoutFailed({
            userIds: [adminId],
            poolName,
            amount: payout.amount,
            reason,
            phones,
          })
        : NotificationEvents.donationPayoutReversed({
            userIds: [adminId],
            poolName,
            amount: payout.netAmount || payout.amount,
            phones,
          }),
    );
  }
}
