import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { randomInt } from 'crypto';
import { Cycle, CycleDocument } from '../cycles/schemas/cycle.schema';
import {
  Contribution,
  ContributionDocument,
} from '../cycles/schemas/contribution.schema';
import {
  GroupWallet,
  GroupWalletDocument,
} from '../cycles/schemas/group-wallet.schema';
import {
  GroupWalletTransaction,
  GroupWalletTransactionDocument,
} from '../cycles/schemas/group-wallet-transaction.schema';
import {
  EscrowDeposit,
  EscrowDepositDocument,
} from '../cycles/schemas/escrow-deposit.schema';
import { Payout, PayoutDocument } from '../cycles/schemas/payout.schema';
import { Group, GroupDocument } from './schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from './schemas/group-member.schema';
import { CreateGroupDto } from './dto/create-group.dto';
import { ContinueGroupDto } from './dto/continue-group.dto';
import { InviteResponseAction } from './dto/respond-to-invite.dto';
import { LockRotationDto } from './dto/lock-rotation.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { CycleStatus, ContributionStatus } from '../common/enums/cycle.enum';
import {
  ContributionFrequency,
  GroupStatus,
  InviteStatus,
  PayoutStatus,
  RotationMethod,
} from '../common/enums/group.enum';
import { PopulatedGroupMember } from './interfaces/populated-group-member.interface';
import { UsersService } from '../users/users.service';
import { GroupAccessService } from './group-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationEvents } from '../notifications/notification-events';

const MEMBER_USER_FIELDS = 'name phone email';

/**
 * Outcome of `GroupsService.purgeTerminatedGroups` — the legacy cleanup that
 * finishes what older API versions left behind (a `status: 'terminated'` row
 * plus all of its group-scoped data).
 */
export interface TerminatedGroupPurgeResult {
  /** How many groups were found with `status: 'terminated'`. */
  scanned: number;
  /** Groups deleted — or, on a dry run, that would be deleted. */
  purged: Array<{ id: string; name: string }>;
  /** Groups left alone because their central account still holds money. */
  skipped: Array<{ id: string; name: string; balance: number }>;
  /** True when nothing was deleted. */
  dryRun: boolean;
}

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(Contribution.name)
    private contributionModel: Model<ContributionDocument>,
    @InjectModel(GroupWallet.name)
    private groupWalletModel: Model<GroupWalletDocument>,
    @InjectModel(GroupWalletTransaction.name)
    private groupWalletTxModel: Model<GroupWalletTransactionDocument>,
    @InjectModel(EscrowDeposit.name)
    private escrowDepositModel: Model<EscrowDepositDocument>,
    @InjectModel(Payout.name)
    private payoutModel: Model<PayoutDocument>,
    @InjectConnection() private connection: Connection,
    private usersService: UsersService,
    private groupAccess: GroupAccessService,
    @Inject(forwardRef(() => NotificationsService))
    private notificationsService: NotificationsService,
  ) {}

  // ---- Helpers ---------------------------------------------------------

  private async populateMember(
    id: Types.ObjectId,
  ): Promise<PopulatedGroupMember> {
    const member = await this.groupMemberModel
      .findById(id)
      .populate('user', MEMBER_USER_FIELDS)
      .lean<PopulatedGroupMember>();

    if (!member) {
      throw new NotFoundException('Group member not found');
    }

    return member;
  }

  /**
   * Unbiased Fisher-Yates shuffle using crypto.randomInt rather than
   * Math.random(), since this directly determines who gets paid (and
   * when) — fairness here matters to users.
   */
  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randomInt(0, i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

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
      })),
      { session },
    );

    return cycle;
  }

  // ---- Groups ------------------------------------------------------------

  /**
   * Creates a group and an ACCEPTED, isGroupAdmin GroupMember for the
   * creator in a single transaction. The creator counts toward
   * `totalSlots`.
   */
  async createGroup(userId: string, dto: CreateGroupDto) {
    const session = await this.connection.startSession();

    try {
      let group: GroupDocument;
      let membership: GroupMemberDocument;

      await session.withTransaction(async () => {
        const [groupDoc] = await this.groupModel.create(
          [
            {
              name: dto.name,
              createdBy: new Types.ObjectId(userId),
              contributionAmount: dto.contributionAmount,
              frequency: dto.frequency ?? ContributionFrequency.MONTHLY,
              totalSlots: dto.totalSlots,
              rotationMethod: dto.rotationMethod,
            },
          ],
          { session },
        );

        const [memberDoc] = await this.groupMemberModel.create(
          [
            {
              group: groupDoc._id,
              user: new Types.ObjectId(userId),
              isGroupAdmin: true,
              inviteStatus: InviteStatus.ACCEPTED,
              respondedAt: new Date(),
            },
          ],
          { session },
        );

        group = groupDoc;
        membership = memberDoc;
      });

      return { group: group!, membership: membership! };
    } finally {
      await session.endSession();
    }
  }

  /**
   * Groups the current user is an ACCEPTED member of, along with their
   * own membership details (position, isGroupAdmin, payoutStatus).
   * Excludes TERMINATED groups from the list.
   */
  async listMyGroups(userId: string) {
    const memberships = await this.groupMemberModel
      .find({
        user: new Types.ObjectId(userId),
        inviteStatus: InviteStatus.ACCEPTED,
      })
      .lean();

    if (memberships.length === 0) {
      return [];
    }

    const groupIds = memberships.map((m) => m.group);
    const groups = await this.groupModel
      .find({ _id: { $in: groupIds }, status: { $ne: GroupStatus.TERMINATED } })
      .lean();
    const groupsById = new Map(groups.map((g) => [g._id.toString(), g]));

    return memberships.map((m) => ({
      group: groupsById.get(m.group.toString()),
      membership: {
        id: m._id.toString(),
        isGroupAdmin: m.isGroupAdmin,
        position: m.position,
        payoutStatus: m.payoutStatus,
      },
    }));
  }

  /**
   * Full group detail including the member roster. Only ACCEPTED
   * members may view this.
   */
  async getGroupDetail(userId: string, groupId: string) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertAcceptedMember(group._id, userId);

    const members = await this.listMembers(groupId);

    return { group, members };
  }

  /**
   * Like listMembers, but first checks the requester is an ACCEPTED
   * member of the group. Used by GET /groups/:id/members.
   */
  async getMembers(
    userId: string,
    groupId: string,
  ): Promise<PopulatedGroupMember[]> {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertAcceptedMember(group._id, userId);

    return this.listMembers(groupId);
  }

  /**
   * Roster for a group, sorted by rotation position (once locked), then
   * by join order. Includes pending/declined invites so the admin can
   * track invite status.
   */
  async listMembers(groupId: string): Promise<PopulatedGroupMember[]> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new BadRequestException('Invalid group id');
    }

    return this.groupMemberModel
      .find({ group: new Types.ObjectId(groupId) })
      .populate('user', MEMBER_USER_FIELDS)
      .sort({ position: 1, createdAt: 1 })
      .lean<PopulatedGroupMember[]>();
  }

  // ---- Invites -------------------------------------------------------------

  /**
   * Admin-only. Sends (or re-sends, if previously declined) an invite to
   * the given phone number.
   *
   * Invites are in-app only: the phone number must already belong to a
   * registered (phone-verified) Ajo user. There is no "stub" account
   * creation — if the person hasn't installed and registered on the app
   * yet, the admin can't invite them until they do.
   */
  async inviteMember(
    adminUserId: string,
    groupId: string,
    phone: string,
  ): Promise<PopulatedGroupMember> {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    if (group.status !== GroupStatus.OPEN_FOR_INVITES) {
      throw new BadRequestException('This group is no longer open for invites');
    }

    const invitee = await this.usersService.findByPhone(phone);

    if (!invitee || !invitee.isPhoneVerified) {
      throw new NotFoundException(
        'This phone number is not registered on Ajo. The person must download the app and sign up before they can be invited.',
      );
    }

    if (invitee._id.toString() === adminUserId) {
      throw new ConflictException('You are already the admin of this group');
    }

    const existing = await this.groupMemberModel.findOne({
      group: group._id,
      user: invitee._id,
    });

    if (existing && existing.inviteStatus !== InviteStatus.DECLINED) {
      throw new ConflictException(
        'This user has already been invited to this group',
      );
    }

    const occupiedSlots = await this.groupMemberModel.countDocuments({
      group: group._id,
      inviteStatus: { $in: [InviteStatus.ACCEPTED, InviteStatus.PENDING] },
    });

    if (occupiedSlots >= group.totalSlots) {
      throw new BadRequestException('This group has no available slots');
    }

    let membership: GroupMemberDocument;

    if (existing) {
      existing.inviteStatus = InviteStatus.PENDING;
      existing.invitedAt = new Date();
      existing.respondedAt = undefined;
      membership = await existing.save();
    } else {
      membership = await this.groupMemberModel.create({
        group: group._id,
        user: invitee._id,
        inviteStatus: InviteStatus.PENDING,
        invitedAt: new Date(),
      });
    }

    const adminUser = await this.usersService.findById(adminUserId);
    const phones = new Map<string, string>([
      [invitee._id.toString(), invitee.phone],
    ]);

    void this.notificationsService.send(
      NotificationEvents.groupInviteReceived({
        userIds: [invitee._id.toString()],
        groupName: group.name,
        adminName: adminUser?.name ?? adminUser?.phone ?? 'The group admin',
        data: {
          groupId: group._id.toString(),
          inviteId: membership._id.toString(),
        },
        phones,
      }),
    );

    return this.populateMember(membership._id);
  }

  /**
   * Pending invites for the current user, with enough group context to
   * decide whether to accept.
   */
  async listMyInvites(userId: string) {
    const memberships = await this.groupMemberModel
      .find({
        user: new Types.ObjectId(userId),
        inviteStatus: InviteStatus.PENDING,
      })
      .lean();

    if (memberships.length === 0) {
      return [];
    }

    const groupIds = memberships.map((m) => m.group);
    const groups = await this.groupModel
      .find({ _id: { $in: groupIds } })
      .populate('createdBy', 'name phone')
      .lean();
    const groupsById = new Map(groups.map((g) => [g._id.toString(), g]));

    return memberships.map((m) => ({
      inviteId: m._id.toString(),
      invitedAt: m.invitedAt,
      group: groupsById.get(m.group.toString()),
    }));
  }

  /**
   * Accept or decline an invite. Only the invited user may respond.
   */
  async respondToInvite(
    userId: string,
    groupMemberId: string,
    action: InviteResponseAction,
  ): Promise<PopulatedGroupMember> {
    if (!Types.ObjectId.isValid(groupMemberId)) {
      throw new BadRequestException('Invalid invite id');
    }

    const membership = await this.groupMemberModel.findById(groupMemberId);

    if (!membership) {
      throw new NotFoundException('Invite not found');
    }

    if (membership.user.toString() !== userId) {
      throw new ForbiddenException('This invite does not belong to you');
    }

    if (membership.inviteStatus !== InviteStatus.PENDING) {
      throw new BadRequestException(
        'This invite has already been responded to',
      );
    }

    membership.inviteStatus =
      action === InviteResponseAction.ACCEPT
        ? InviteStatus.ACCEPTED
        : InviteStatus.DECLINED;
    membership.respondedAt = new Date();
    await membership.save();

    const populated = await this.populateMember(membership._id);

    // Notify the group admin of the response.
    const group = await this.groupModel.findById(membership.group);
    const adminMembership = group
      ? await this.groupMemberModel.findOne({
          group: group._id,
          isGroupAdmin: true,
        })
      : null;

    if (group && adminMembership) {
      const respondingUser = await this.usersService.findById(userId);
      const memberName =
        respondingUser?.name ?? respondingUser?.phone ?? 'A member';

      const eventParams = {
        userIds: [adminMembership.user.toString()],
        memberName,
        groupName: group.name,
        data: { groupId: group._id.toString() },
      };

      void this.notificationsService.send(
        action === InviteResponseAction.ACCEPT
          ? NotificationEvents.groupInviteAccepted(eventParams)
          : NotificationEvents.groupInviteDeclined(eventParams),
      );
    }

    return populated;
  }

  // ---- Rotation order -------------------------------------------------------

  /**
   * Locks the payout order for a group. Requires every slot to be
   * filled with an ACCEPTED member first.
   *
   * - MANUAL: `dto.order` must list every accepted member's id, in the
   *   desired payout order.
   * - RANDOM: server shuffles accepted members using a CSPRNG.
   */
  async lockRotation(
    adminUserId: string,
    groupId: string,
    dto: LockRotationDto,
  ) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    if (group.status !== GroupStatus.OPEN_FOR_INVITES) {
      throw new BadRequestException(
        'The rotation order for this group has already been locked',
      );
    }

    const acceptedMembers = await this.groupMemberModel
      .find({ group: group._id, inviteStatus: InviteStatus.ACCEPTED })
      .sort({ createdAt: 1 });

    if (acceptedMembers.length !== group.totalSlots) {
      throw new BadRequestException(
        `All ${group.totalSlots} slots must be filled and accepted before locking the rotation order (currently ${acceptedMembers.length} accepted)`,
      );
    }

    let orderedMembers: GroupMemberDocument[];

    if (group.rotationMethod === RotationMethod.MANUAL) {
      if (!dto.order || dto.order.length !== acceptedMembers.length) {
        throw new BadRequestException(
          `order must contain exactly ${acceptedMembers.length} group member ids`,
        );
      }

      const acceptedIds = new Set(acceptedMembers.map((m) => m._id.toString()));
      const orderIds = new Set(dto.order);

      const sameSize = orderIds.size === dto.order.length;
      const sameMembers =
        sameSize && [...acceptedIds].every((id) => orderIds.has(id));

      if (!sameMembers) {
        throw new BadRequestException(
          'order must contain exactly the accepted members of this group, each exactly once',
        );
      }

      const byId = new Map(acceptedMembers.map((m) => [m._id.toString(), m]));
      orderedMembers = dto.order.map(
        (id) => byId.get(id) as GroupMemberDocument,
      );
    } else {
      orderedMembers = this.shuffle(acceptedMembers);
    }

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        for (let i = 0; i < orderedMembers.length; i++) {
          orderedMembers[i].position = i + 1;
          await orderedMembers[i].save({ session });
        }

        group.status = GroupStatus.ORDER_LOCKED;
        group.orderLockedAt = new Date();
        await group.save({ session });
      });
    } finally {
      await session.endSession();
    }

    void Promise.all(
      orderedMembers.map((member, index) =>
        this.notificationsService.send(
          NotificationEvents.rotationOrderLocked({
            userIds: [member.user.toString()],
            groupName: group.name,
            position: index + 1,
            data: { groupId: group._id.toString() },
          }),
        ),
      ),
    );

    return this.listMembers(groupId);
  }

  // ---- Continue / Terminate (post-completion) --------------------------------

  /**
   * Admin-only. Starts a new round of cycles for a completed group.
   * The admin may optionally update the contribution amount, frequency,
   * or total slots before continuing. Existing rotation positions are
   * preserved. A new Cycle 1 is created with the member at position 1
   * as the recipient.
   */
  async continueGroup(
    adminUserId: string,
    groupId: string,
    dto: ContinueGroupDto,
  ) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    if (group.status !== GroupStatus.COMPLETED) {
      throw new BadRequestException('Only completed groups can be continued');
    }

    // Apply optional updates
    if (dto.contributionAmount !== undefined) {
      group.contributionAmount = dto.contributionAmount;
    }
    if (dto.frequency !== undefined) {
      group.frequency = dto.frequency;
    }
    if (dto.totalSlots !== undefined) {
      const acceptedCount = await this.groupMemberModel.countDocuments({
        group: group._id,
        inviteStatus: InviteStatus.ACCEPTED,
      });
      if (dto.totalSlots < acceptedCount) {
        throw new BadRequestException(
          `Cannot reduce slots below current member count (${acceptedCount})`,
        );
      }
      group.totalSlots = dto.totalSlots;
    }

    const members = await this.groupMemberModel
      .find({ group: group._id, inviteStatus: InviteStatus.ACCEPTED })
      .sort({ position: 1 });

    const recipient = members.find((m) => m.position === 1);
    if (!recipient) {
      throw new BadRequestException('No member found at rotation position 1');
    }

    // Reset all members' payoutStatus to PENDING for the new round
    for (const member of members) {
      member.payoutStatus = PayoutStatus.PENDING;
    }
    await Promise.all(members.map((m) => m.save()));

    const now = new Date();
    const dueDate = this.computeNextDueDate(now, group.frequency);

    // Cycle numbers restart at 1 for each round. Scoping by round keeps
    // the completed round (cycles 1..N) as history instead of the new
    // round (cycle 1) colliding on the (group, round, cycleNumber) index.
    const nextRound = (group.currentRound ?? 1) + 1;

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // Ensure a group wallet exists (should already, but be safe)
        let groupWallet = await this.groupWalletModel
          .findOne({ group: group._id })
          .session(session);
        if (!groupWallet) {
          [groupWallet] = await this.groupWalletModel.create(
            [{ group: group._id, balance: 0 }],
            { session },
          );
        }

        await this.createCycleWithContributions(
          group,
          nextRound,
          1,
          recipient,
          dueDate,
          members,
          session,
        );

        group.status = GroupStatus.ACTIVE;
        group.startDate = now;
        group.currentRound = nextRound;
        group.currentCycleNumber = 1;
        await group.save({ session });
      });
    } finally {
      await session.endSession();
    }

    // Notify all members
    const memberIds = members.map((m) => m.user.toString());
    void this.notificationsService.send(
      NotificationEvents.groupContinued({
        userIds: memberIds,
        groupName: group.name,
        cycleNumber: 1,
        contributionAmount: group.contributionAmount,
        dueDate,
        data: { groupId: group._id.toString() },
      }),
    );

    return { group: group.toObject(), members };
  }

  /**
   * Admin-only. Permanently ends a completed group by deleting it — and
   * every record that belongs to it — from the database.
   *
   * Cascaded: GroupMember, Cycle, Contribution, GroupWallet,
   * GroupWalletTransaction, EscrowDeposit, Payout, then the Group itself.
   * Members' personal wallet ledger (`WalletTransaction`) is deliberately
   * left alone — that is the user's own money history, not group data.
   *
   * Nothing is left behind to filter out: the group no longer appears in
   * `listMyGroups`, invites, Group-ID search, or the admin panel because the
   * row is gone. Members are notified after the delete commits. The delete
   * itself lives in `purgeGroup`, shared with the legacy cleanup script.
   */
  async terminateGroup(adminUserId: string, groupId: string) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    if (group.status !== GroupStatus.COMPLETED) {
      throw new BadRequestException('Only completed groups can be terminated');
    }

    // Never wipe a group while member money is still sitting in its central
    // account — that balance has to be paid out first.
    const groupWallet = await this.groupWalletModel.findOne({
      group: group._id,
    });
    if (groupWallet && groupWallet.balance > 0) {
      throw new BadRequestException(
        `The group account still holds ₦${groupWallet.balance.toLocaleString()}. ` +
          'Pay it out before terminating the group.',
      );
    }

    const members = await this.groupMemberModel.find({
      group: group._id,
      inviteStatus: InviteStatus.ACCEPTED,
    });
    const memberIds = members.map((m) => m.user.toString());

    // Captured before the documents are deleted — the notification still has
    // to name the group.
    const groupObjectId = group._id;
    const groupName = group.name;

    await this.purgeGroup(groupObjectId);

    // Notify all members
    void this.notificationsService.send(
      NotificationEvents.groupTerminated({
        userIds: memberIds,
        groupName,
        data: { groupId: groupObjectId.toString() },
      }),
    );

    return {
      groupId: groupObjectId.toString(),
      status: GroupStatus.TERMINATED,
    };
  }

  /**
   * Deletes a group and every document scoped to it: GroupWalletTransaction,
   * EscrowDeposit, Payout, Contribution, Cycle, GroupWallet, GroupMember, then
   * the Group itself.
   *
   * Everything is group-scoped, so it all goes in one transaction — a
   * half-deleted group would leave cycles/contributions pointing at nothing.
   * Members' personal wallet ledger (`WalletTransaction`) is deliberately left
   * alone: that is the user's own money history, not group data.
   *
   * Shared by `terminateGroup` (the live path) and `purgeTerminatedGroups`
   * (the one-off legacy cleanup), so both paths delete exactly the same
   * records.
   */
  async purgeGroup(groupId: Types.ObjectId): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        await this.groupWalletTxModel.deleteMany(
          { group: groupId },
          { session },
        );
        await this.escrowDepositModel.deleteMany(
          { group: groupId },
          { session },
        );
        await this.payoutModel.deleteMany({ group: groupId }, { session });
        await this.contributionModel.deleteMany(
          { group: groupId },
          { session },
        );
        await this.cycleModel.deleteMany({ group: groupId }, { session });
        await this.groupWalletModel.deleteMany({ group: groupId }, { session });
        await this.groupMemberModel.deleteMany({ group: groupId }, { session });
        await this.groupModel.deleteOne({ _id: groupId }, { session });
      });
    } finally {
      await session.endSession();
    }
  }

  // ---- Legacy purge (groups terminated before termination deleted them) ---

  /**
   * One-off cleanup for groups terminated by older versions of the API, which
   * flipped `status` to TERMINATED and left the row — plus its memberships,
   * cycles, contributions, wallet ledger, escrow deposits and payouts — in the
   * database. Each legacy group is purged exactly the way `terminateGroup`
   * purges a group today.
   *
   * A legacy group whose central account still holds money is skipped and
   * reported instead: that balance belongs to the members and has to be paid
   * out first, the same rule live termination enforces.
   *
   * Idempotent — re-running it only finds whatever is still marked TERMINATED.
   * Backs `npm run seed:purge-terminated-groups`.
   */
  async purgeTerminatedGroups(
    options: { dryRun?: boolean } = {},
  ): Promise<TerminatedGroupPurgeResult> {
    const dryRun = options.dryRun ?? false;

    const terminatedGroups = await this.groupModel
      .find({ status: GroupStatus.TERMINATED })
      .select('name');

    const purged: TerminatedGroupPurgeResult['purged'] = [];
    const skipped: TerminatedGroupPurgeResult['skipped'] = [];

    for (const group of terminatedGroups) {
      const groupWallet = await this.groupWalletModel
        .findOne({ group: group._id })
        .select('balance');

      if (groupWallet && groupWallet.balance > 0) {
        skipped.push({
          id: group._id.toString(),
          name: group.name,
          balance: groupWallet.balance,
        });
        continue;
      }

      if (!dryRun) {
        await this.purgeGroup(group._id);
      }

      purged.push({ id: group._id.toString(), name: group.name });
    }

    return { dryRun, scanned: terminatedGroups.length, purged, skipped };
  }

  // ---- Auto-collect toggle (Phase 6) -----------------------------------------

  /**
   * Admin-only. Switches automatic contribution collection on/off for
   * this group. When ON, `AutoCollectScheduler` debits member wallets
   * for the current cycle once its dueDate arrives, without the admin
   * needing to trigger `POST .../collect-contributions` manually. When
   * OFF (the default), collection stays a manual admin action.
   */
  async setAutoCollect(adminUserId: string, groupId: string, enabled: boolean) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    group.autoCollectEnabled = enabled;
    await group.save();

    return {
      groupId: group._id.toString(),
      autoCollectEnabled: group.autoCollectEnabled,
    };
  }

  async updateGroup(adminUserId: string, groupId: string, dto: UpdateGroupDto) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    if (dto.name !== undefined) {
      group.name = dto.name;
    }
    if (dto.contributionAmount !== undefined) {
      group.contributionAmount = dto.contributionAmount;
    }
    if (dto.frequency !== undefined) {
      group.frequency = dto.frequency;
    }
    if (dto.totalSlots !== undefined) {
      const acceptedCount = await this.groupMemberModel.countDocuments({
        group: group._id,
        inviteStatus: InviteStatus.ACCEPTED,
      });
      if (dto.totalSlots < acceptedCount) {
        throw new BadRequestException(
          `Cannot reduce slots below current member count (${acceptedCount})`,
        );
      }
      group.totalSlots = dto.totalSlots;
    }

    await group.save();

    const updatedGroup = await this.groupModel.findById(group._id).lean();
    const members = await this.listMembers(groupId);

    // Notify all group members of the update
    const memberIds = members.map((m) => m.user.toString());
    const adminUser = await this.usersService.findById(adminUserId);
    const adminName = adminUser?.name ?? adminUser?.phone ?? 'Admin';

    void this.notificationsService.send(
      NotificationEvents.groupUpdated({
        userIds: memberIds,
        groupName: group.name,
        adminName,
        data: { groupId: group._id.toString() },
      }),
    );

    return { group: updatedGroup, members };
  }
}
