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
import { CycleStatus } from '../common/enums/cycle.enum';
import { ContributionStatus } from '../common/enums/cycle.enum';
import { GroupStatus } from '../common/enums/group.enum';
import { UsersService } from '../users/users.service';

@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

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
   * Runs every day at 9:00 AM (server time). Finds all OPEN cycles with a
   * dueDate that is 3 days away (gentle reminder) or 1 day / same day
   * (urgent reminder), and sends a notification to every member who still
   * has a PENDING contribution.
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendContributionReminders(): Promise<void> {
    this.logger.log('Running contribution reminder job...');

    const now = new Date();

    // Build date-range windows for T-3 (gentle) and T-1/T-0 (urgent).
    const threeDaysFromNow = this.dayRange(now, 3);
    const oneDayFromNow = this.dayRange(now, 1);
    const today = this.dayRange(now, 0);

    const [gentleCycles, urgentCycles] = await Promise.all([
      this.findCyclesWithDueDate(threeDaysFromNow.start, threeDaysFromNow.end),
      this.findCyclesWithDueDate(
        Math.min(oneDayFromNow.start, today.start),
        Math.max(oneDayFromNow.end, today.end),
      ),
    ]);

    await Promise.all([
      ...gentleCycles.map((c) => this.sendReminder(c, 3)),
      ...urgentCycles.map((c) =>
        this.sendReminder(c, c.dueDate <= now ? 0 : 1),
      ),
    ]);

    this.logger.log(
      `Reminder job done. Gentle: ${gentleCycles.length} cycle(s), Urgent: ${urgentCycles.length} cycle(s).`,
    );
  }

  private dayRange(
    base: Date,
    daysAhead: number,
  ): { start: number; end: number } {
    const d = new Date(base);
    d.setDate(d.getDate() + daysAhead);
    d.setHours(0, 0, 0, 0);
    const start = d.getTime();
    d.setHours(23, 59, 59, 999);
    const end = d.getTime();
    return { start, end };
  }

  private async findCyclesWithDueDate(
    startMs: number,
    endMs: number,
  ): Promise<CycleDocument[]> {
    return this.cycleModel.find({
      status: CycleStatus.OPEN,
      dueDate: { $gte: new Date(startMs), $lte: new Date(endMs) },
    });
  }

  private async sendReminder(
    cycle: CycleDocument,
    daysLeft: number,
  ): Promise<void> {
    try {
      const [group, pendingContributions] = await Promise.all([
        this.groupModel.findById(cycle.group),
        this.contributionModel.find({
          cycle: cycle._id,
          status: ContributionStatus.PENDING,
        }),
      ]);

      if (!group || group.status !== GroupStatus.ACTIVE) return;
      if (pendingContributions.length === 0) return;

      const userIds = pendingContributions.map((c) => c.user.toString());

      // Build a phone map for SMS (urgent only)
      const phones = new Map<string, string>();
      if (daysLeft <= 1) {
        await Promise.all(
          userIds.map(async (uid) => {
            const user = await this.usersService.findById(uid);
            if (user?.phone) phones.set(uid, user.phone);
          }),
        );
      }

      const payload =
        daysLeft <= 1
          ? NotificationEvents.contributionDueUrgent({
              userIds,
              groupName: group.name,
              amount: cycle.contributionAmount,
              dueDate: cycle.dueDate,
              data: {
                groupId: group._id.toString(),
                cycleId: cycle._id.toString(),
              },
              phones,
            })
          : NotificationEvents.contributionDueReminder({
              userIds,
              groupName: group.name,
              amount: cycle.contributionAmount,
              daysLeft,
              dueDate: cycle.dueDate,
              data: {
                groupId: group._id.toString(),
                cycleId: cycle._id.toString(),
              },
            });

      await this.notificationsService.send(payload);
    } catch (err) {
      this.logger.error(
        `Failed to send reminder for cycle ${cycle._id.toString()}: ${String(err)}`,
      );
    }
  }
}
