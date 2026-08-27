import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../groups/schemas/group-member.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Cycle, CycleDocument } from '../cycles/schemas/cycle.schema';
import {
  Contribution,
  ContributionDocument,
} from '../cycles/schemas/contribution.schema';
import {
  GroupWallet,
  GroupWalletDocument,
} from '../cycles/schemas/group-wallet.schema';
import { Payout, PayoutDocument } from '../cycles/schemas/payout.schema';
import { ListGroupsQueryDto } from './dto/list-groups-query.dto';
import { ContributionStatus } from '../common/enums/cycle.enum';

export interface PaginatedGroups {
  groups: Array<{
    id: string;
    name: string;
    status: string;
    contributionAmount: number;
    frequency: string;
    totalSlots: number;
    rotationMethod: string;
    autoCollectEnabled: boolean;
    currentCycleNumber: number | null;
    createdAt: Date;
  }>;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GroupMemberStanding {
  groupMemberId: string;
  user: { id: string; name?: string; phone: string; email?: string };
  isGroupAdmin: boolean;
  inviteStatus: string;
  position: number | null;
  payoutStatus: string;
  defaultCount: number;
}

export interface GroupCycleSummary {
  cycleId: string;
  cycleNumber: number;
  status: string;
  dueDate: Date;
  contributionAmount: number;
  totalSlots: number;
  paidCount: number;
  defaultedCount: number;
  pendingCount: number;
  completedAt?: Date;
}

export interface GroupPayoutSummary {
  payoutId: string;
  cycleNumber: number;
  recipient: { id: string; name?: string; phone: string };
  amount: number;
  status: string;
  failureReason?: string;
  completedAt?: Date;
  createdAt: Date;
}

export interface GroupDetail {
  id: string;
  name: string;
  status: string;
  contributionAmount: number;
  frequency: string;
  totalSlots: number;
  rotationMethod: string;
  autoCollectEnabled: boolean;
  currentCycleNumber: number | null;
  orderLockedAt?: Date;
  startDate?: Date;
  centralWalletBalance: number;
  admin?: { id: string; name?: string; phone: string };
  members: GroupMemberStanding[];
  cycles: GroupCycleSummary[];
  payouts: GroupPayoutSummary[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Platform-admin-scoped read access to ALL groups on the platform — for
 * the admin web console's Groups directory. Distinct from
 * GroupDashboardService (Phase 6), which is the same kind of data but
 * scoped to a single group's OWN admin via GroupAccessService — this
 * service has no such restriction, since "browse every group" is
 * exactly the platform_admin capability this console exists for.
 */
@Injectable()
export class PlatformAdminGroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(Contribution.name)
    private contributionModel: Model<ContributionDocument>,
    @InjectModel(GroupWallet.name)
    private groupWalletModel: Model<GroupWalletDocument>,
    @InjectModel(Payout.name) private payoutModel: Model<PayoutDocument>,
  ) {}

  /**
   * Paginated, optionally filtered/searched list of every group on the
   * platform. Search matches the group name as a case-insensitive
   * substring — same simplicity tradeoff as PlatformAdminUsersService.
   */
  async listGroups(query: ListGroupsQueryDto): Promise<PaginatedGroups> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = new RegExp(escaped, 'i');
    }

    const [groups, total] = await Promise.all([
      this.groupModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.groupModel.countDocuments(filter),
    ]);

    return {
      groups: groups.map((g) => ({
        id: g._id.toString(),
        name: g.name,
        status: g.status,
        contributionAmount: g.contributionAmount,
        frequency: g.frequency,
        totalSlots: g.totalSlots,
        rotationMethod: g.rotationMethod,
        autoCollectEnabled: g.autoCollectEnabled,
        currentCycleNumber: g.currentCycleNumber ?? null,
        createdAt: (g as unknown as { createdAt: Date }).createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Full detail view for a single group: settings, central wallet
   * balance, the admin, every member's standing, the full cycle
   * history with a paid/defaulted/pending breakdown per cycle, and
   * every payout attempt (success/failed/reversed included, not just
   * the current one) — useful for support/reconciliation, where seeing
   * a failed transfer's reason matters.
   */
  async getGroupDetail(groupId: string): Promise<GroupDetail> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new NotFoundException('Group not found');
    }

    const group = await this.groupModel.findById(groupId).lean();

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const [members, wallet, cycles, payouts] = await Promise.all([
      this.groupMemberModel
        .find({ group: group._id })
        .populate('user', 'name phone email')
        .sort({ position: 1, createdAt: 1 })
        .lean(),
      this.groupWalletModel.findOne({ group: group._id }).lean(),
      this.cycleModel
        .find({ group: group._id })
        .sort({ cycleNumber: 1 })
        .lean(),
      this.payoutModel
        .find({ group: group._id })
        .populate('recipientUser', 'name phone')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const adminMembership = members.find((m) => m.isGroupAdmin);
    const adminUser = adminMembership?.user as unknown as
      | { _id: Types.ObjectId; name?: string; phone: string }
      | undefined;

    const memberStandings: GroupMemberStanding[] = members.map((m) => {
      const user = m.user as unknown as {
        _id: Types.ObjectId;
        name?: string;
        phone: string;
        email?: string;
      };

      return {
        groupMemberId: m._id.toString(),
        user: {
          id: user._id.toString(),
          name: user.name,
          phone: user.phone,
          email: user.email,
        },
        isGroupAdmin: m.isGroupAdmin,
        inviteStatus: m.inviteStatus,
        position: m.position,
        payoutStatus: m.payoutStatus,
        defaultCount: m.defaultCount,
      };
    });

    let cycleSummaries: GroupCycleSummary[] = [];

    if (cycles.length > 0) {
      const cycleIds = cycles.map((c) => c._id);
      const contributions = await this.contributionModel
        .find({ cycle: { $in: cycleIds } })
        .select('cycle status')
        .lean();

      const countsByCycle = new Map<
        string,
        { paid: number; pending: number; defaulted: number }
      >();

      for (const cycle of cycles) {
        countsByCycle.set(cycle._id.toString(), {
          paid: 0,
          pending: 0,
          defaulted: 0,
        });
      }

      for (const contribution of contributions) {
        const counts = countsByCycle.get(contribution.cycle.toString());
        if (!counts) continue;

        if (contribution.status === ContributionStatus.PAID) counts.paid += 1;
        else if (contribution.status === ContributionStatus.DEFAULTED)
          counts.defaulted += 1;
        else counts.pending += 1;
      }

      cycleSummaries = cycles.map((cycle) => {
        const counts = countsByCycle.get(cycle._id.toString())!;
        return {
          cycleId: cycle._id.toString(),
          cycleNumber: cycle.cycleNumber,
          status: cycle.status,
          dueDate: cycle.dueDate,
          contributionAmount: cycle.contributionAmount,
          totalSlots: cycle.totalSlots,
          paidCount: counts.paid,
          defaultedCount: counts.defaulted,
          pendingCount: counts.pending,
          completedAt: cycle.completedAt,
        };
      });
    }

    const cycleNumberById = new Map(
      cycles.map((c) => [c._id.toString(), c.cycleNumber]),
    );

    const payoutSummaries: GroupPayoutSummary[] = payouts.map((p) => {
      const recipient = p.recipientUser as unknown as {
        _id: Types.ObjectId;
        name?: string;
        phone: string;
      };

      return {
        payoutId: p._id.toString(),
        cycleNumber: cycleNumberById.get(p.cycle.toString()) ?? 0,
        recipient: {
          id: recipient._id.toString(),
          name: recipient.name,
          phone: recipient.phone,
        },
        amount: p.amount,
        status: p.status,
        failureReason: p.failureReason,
        completedAt: p.completedAt,
        createdAt: (p as unknown as { createdAt: Date }).createdAt,
      };
    });

    return {
      id: group._id.toString(),
      name: group.name,
      status: group.status,
      contributionAmount: group.contributionAmount,
      frequency: group.frequency,
      totalSlots: group.totalSlots,
      rotationMethod: group.rotationMethod,
      autoCollectEnabled: group.autoCollectEnabled,
      currentCycleNumber: group.currentCycleNumber ?? null,
      orderLockedAt: group.orderLockedAt,
      startDate: group.startDate,
      centralWalletBalance: wallet?.balance ?? 0,
      admin: adminUser
        ? {
            id: adminUser._id.toString(),
            name: adminUser.name,
            phone: adminUser.phone,
          }
        : undefined,
      members: memberStandings,
      cycles: cycleSummaries,
      payouts: payoutSummaries,
      createdAt: (group as unknown as { createdAt: Date }).createdAt,
      updatedAt: (group as unknown as { updatedAt: Date }).updatedAt,
    };
  }

  /**
   * Updates the service fee for a group. Only platform admins can do this.
   * The new fee applies to all future contribution collections.
   */
  async updateServiceFee(
    groupId: string,
    serviceFee: number | undefined,
  ): Promise<GroupDetail> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new NotFoundException('Group not found');
    }

    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (serviceFee !== undefined) {
      group.serviceFee = serviceFee;
      await group.save();
    }

    return this.getGroupDetail(groupId);
  }

  /**
   * Overrides the group's auto-collect setting on behalf of a platform
   * admin. This writes the same `autoCollectEnabled` flag the group's own
   * admin controls from the mobile app, so a platform toggle here can
   * override (and be overridden by) the group admin — whichever was set
   * last wins.
   *
   * When enabled (true), the AutoCollectScheduler auto-debits member
   * wallets for due cycles and the payout proceeds automatically. When
   * disabled (false), collection/withdrawal stays a manual group-admin
   * action.
   */
  async setAutoCollect(
    groupId: string,
    enabled: boolean,
  ): Promise<GroupDetail> {
    if (!Types.ObjectId.isValid(groupId)) {
      throw new NotFoundException('Group not found');
    }

    const group = await this.groupModel.findById(groupId);
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    group.autoCollectEnabled = enabled;
    await group.save();

    return this.getGroupDetail(groupId);
  }
}
