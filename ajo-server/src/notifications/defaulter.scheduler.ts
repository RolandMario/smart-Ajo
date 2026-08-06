import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cycle, CycleDocument } from '../cycles/schemas/cycle.schema';
import {
  Contribution,
  ContributionDocument,
} from '../cycles/schemas/contribution.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import {
  GroupMember,
  GroupMemberDocument,
} from '../groups/schemas/group-member.schema';
import { NotificationsService } from './notifications.service';
import { NotificationEvents } from './notification-events';
import { ContributionStatus, CycleStatus } from '../common/enums/cycle.enum';
import { GroupStatus } from '../common/enums/group.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class DefaulterScheduler {
  private readonly logger = new Logger(DefaulterScheduler.name);

  constructor(
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(Contribution.name)
    private contributionModel: Model<ContributionDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(GroupMember.name)
    private groupMemberModel: Model<GroupMemberDocument>,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
  ) {}

  /**
   * Runs every day at 10:00 AM (an hour after the reminder job, so
   * members who were nudged this morning have had a chance to act
   * before being flagged). Finds every OPEN cycle whose dueDate has
   * passed and flags any still-PENDING contribution as DEFAULTED.
   *
   * This is purely a tracking/flagging action — no fee, no suspension,
   * no automatic consequence. The flag exists so the admin dashboard
   * can surface "who's behind" without the admin manually auditing
   * every contribution.
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async flagDefaulters(): Promise<void> {
    this.logger.log('Running defaulter flagging job...');

    const now = new Date();

    const overdueCycles = await this.cycleModel.find({
      status: CycleStatus.OPEN,
      dueDate: { $lt: now },
    });

    let totalFlagged = 0;

    for (const cycle of overdueCycles) {
      const flagged = await this.flagCycleDefaulters(cycle);
      totalFlagged += flagged;
    }

    this.logger.log(
      `Defaulter flagging done. ${overdueCycles.length} overdue cycle(s) checked, ${totalFlagged} contribution(s) flagged.`,
    );
  }

  /**
   * Flags PENDING contributions for a single overdue cycle. Exposed
   * separately (not just as a private method) so it can also be called
   * on-demand by an admin endpoint if needed, without waiting for the
   * next scheduled run.
   */
  async flagCycleDefaulters(cycle: CycleDocument): Promise<number> {
    try {
      const group = await this.groupModel.findById(cycle.group);
      if (!group || group.status !== GroupStatus.ACTIVE) return 0;

      const pendingContributions = await this.contributionModel.find({
        cycle: cycle._id,
        status: ContributionStatus.PENDING,
      });

      if (pendingContributions.length === 0) return 0;

      const now = new Date();

      for (const contribution of pendingContributions) {
        contribution.status = ContributionStatus.DEFAULTED;
        contribution.flaggedAt = now;
        await contribution.save();

        await this.groupMemberModel.updateOne(
          { _id: contribution.member },
          { $inc: { defaultCount: 1 } },
        );

        await this.notifyMember(group, cycle, contribution);
      }

      await this.notifyAdmin(group, cycle, pendingContributions.length);

      return pendingContributions.length;
    } catch (err) {
      this.logger.error(
        `Failed to flag defaulters for cycle ${cycle._id.toString()}: ${String(err)}`,
      );
      return 0;
    }
  }

  private async notifyMember(
    group: GroupDocument,
    cycle: CycleDocument,
    contribution: ContributionDocument,
  ): Promise<void> {
    try {
      const user = await this.usersService.findById(
        contribution.user.toString(),
      );
      const phones = user
        ? new Map([[contribution.user.toString(), user.phone]])
        : undefined;

      await this.notificationsService.send(
        NotificationEvents.contributionDefaulted({
          userIds: [contribution.user.toString()],
          groupName: group.name,
          amount: contribution.amount,
          dueDate: cycle.dueDate,
          data: {
            groupId: group._id.toString(),
            cycleId: cycle._id.toString(),
          },
          phones,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to notify defaulting member: ${String(err)}`);
    }
  }

  private async notifyAdmin(
    group: GroupDocument,
    cycle: CycleDocument,
    defaulterCount: number,
  ): Promise<void> {
    try {
      const adminMembership = await this.groupMemberModel.findOne({
        group: group._id,
        isGroupAdmin: true,
      });

      if (!adminMembership) return;

      await this.notificationsService.send(
        NotificationEvents.adminDefaulterSummary({
          userIds: [adminMembership.user.toString()],
          groupName: group.name,
          defaulterCount,
          cycleNumber: cycle.cycleNumber,
          data: {
            groupId: group._id.toString(),
            cycleId: cycle._id.toString(),
          },
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to notify admin of defaulters: ${String(err)}`);
    }
  }
}
