import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  GroupMember,
  GroupMemberDocument,
} from '../groups/schemas/group-member.schema';
import { Cycle, CycleDocument } from '../cycles/schemas/cycle.schema';
import {
  Contribution,
  ContributionDocument,
} from '../cycles/schemas/contribution.schema';
import { GroupAccessService } from '../groups/group-access.service';
import { ContributionStatus } from '../common/enums/cycle.enum';

const MEMBER_USER_FIELDS = 'name phone email';

export interface MemberStanding {
  groupMemberId: string;
  user: { id: string; name?: string; phone: string; email?: string };
  position: number | null;
  isGroupAdmin: boolean;
  payoutStatus: string;
  defaultCount: number;
  currentCycleStatus: ContributionStatus | null;
}

export interface DefaulterEntry {
  contributionId: string;
  cycleId: string;
  cycleNumber: number;
  dueDate: Date;
  amount: number;
  user: { id: string; name?: string; phone: string; email?: string };
  defaultCount: number;
  flaggedAt?: Date;
}

/**
 * Group-admin-facing dashboard data: who's behind, who's reliable, and a
 * per-cycle contribution breakdown. This is distinct from the
 * platform_admin web dashboard (which monitors ALL groups) — this module
 * serves any group's own admin, viewing only their group(s).
 */
@Injectable()
export class GroupDashboardService {
  constructor(
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(Contribution.name)
    private contributionModel: Model<ContributionDocument>,
    private groupAccess: GroupAccessService,
  ) {}

  /**
   * Every member currently flagged DEFAULTED on any OPEN cycle in this
   * group, plus their historical defaultCount, sorted worst-first.
   * Admin-only.
   */
  async listCurrentDefaulters(
    adminUserId: string,
    groupId: string,
  ): Promise<DefaulterEntry[]> {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const defaultedContributions = await this.contributionModel
      .find({ group: group._id, status: ContributionStatus.DEFAULTED })
      .populate('user', MEMBER_USER_FIELDS)
      .populate('cycle')
      .lean();

    const memberIds = defaultedContributions.map((c) => c.member);
    const members = await this.groupMemberModel
      .find({ _id: { $in: memberIds } })
      .select('defaultCount')
      .lean();
    const defaultCountByMember = new Map(
      members.map((m) => [m._id.toString(), m.defaultCount]),
    );

    const entries: DefaulterEntry[] = defaultedContributions.map((c) => {
      const cycle = c.cycle as unknown as CycleDocument;
      const user = c.user as unknown as {
        _id: Types.ObjectId;
        name?: string;
        phone: string;
        email?: string;
      };

      return {
        contributionId: c._id.toString(),
        cycleId: cycle._id.toString(),
        cycleNumber: cycle.cycleNumber,
        dueDate: cycle.dueDate,
        amount: c.amount,
        user: {
          id: user._id.toString(),
          name: user.name,
          phone: user.phone,
          email: user.email,
        },
        defaultCount: defaultCountByMember.get(c.member.toString()) ?? 0,
        flaggedAt: c.flaggedAt,
      };
    });

    return entries.sort((a, b) => b.defaultCount - a.defaultCount);
  }

  /**
   * Full member roster annotated with their standing: rotation
   * position, payout status, historical default count, and their
   * contribution status for the CURRENT cycle (null if the group hasn't
   * been activated yet). Useful for a single "group health" screen.
   * Admin-only.
   */
  async getMemberStandings(
    adminUserId: string,
    groupId: string,
  ): Promise<MemberStanding[]> {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const members = await this.groupMemberModel
      .find({ group: group._id })
      .populate('user', MEMBER_USER_FIELDS)
      .sort({ position: 1, createdAt: 1 })
      .lean();

    let currentContributionByMember = new Map<string, ContributionStatus>();

    if (group.currentCycleNumber) {
      const currentCycle = await this.cycleModel.findOne({
        group: group._id,
        cycleNumber: group.currentCycleNumber,
      });

      if (currentCycle) {
        const contributions = await this.contributionModel
          .find({ cycle: currentCycle._id })
          .select('member status')
          .lean();

        currentContributionByMember = new Map(
          contributions.map((c) => [c.member.toString(), c.status]),
        );
      }
    }

    return members.map((m) => {
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
        position: m.position,
        isGroupAdmin: m.isGroupAdmin,
        payoutStatus: m.payoutStatus,
        defaultCount: m.defaultCount,
        currentCycleStatus:
          currentContributionByMember.get(m._id.toString()) ?? null,
      };
    });
  }

  /**
   * Per-cycle contribution breakdown for the whole group's history —
   * how many paid, defaulted, or are still pending, per cycle. Useful
   * for a simple bar-chart-style admin view of group health over time.
   * Admin-only.
   */
  async getContributionSummary(adminUserId: string, groupId: string) {
    const group = await this.groupAccess.getGroupOrThrow(groupId);
    await this.groupAccess.assertGroupAdmin(group._id, adminUserId);

    const cycles = await this.cycleModel
      .find({ group: group._id })
      .sort({ cycleNumber: 1 })
      .lean();

    if (cycles.length === 0) return [];

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

    return cycles.map((cycle) => ({
      cycleId: cycle._id.toString(),
      cycleNumber: cycle.cycleNumber,
      status: cycle.status,
      dueDate: cycle.dueDate,
      ...countsByCycle.get(cycle._id.toString())!,
    }));
  }
}
