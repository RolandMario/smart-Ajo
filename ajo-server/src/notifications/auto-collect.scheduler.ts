import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cycle, CycleDocument } from '../cycles/schemas/cycle.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { CyclesService } from '../cycles/cycles.service';
import { CycleStatus } from '../common/enums/cycle.enum';
import { GroupStatus } from '../common/enums/group.enum';

@Injectable()
export class AutoCollectScheduler {
  private readonly logger = new Logger(AutoCollectScheduler.name);

  constructor(
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    private cyclesService: CyclesService,
  ) {}

  /**
   * Runs every day at 8:00 AM — before the reminder job (9 AM) and the
   * defaulter flagging job (10 AM), so groups with auto-collect enabled
   * get a chance to actually collect before a member is reminded or
   * flagged for a contribution that may have already gone through.
   *
   * Only acts on groups with `autoCollectEnabled: true`. Groups left at
   * the default (false) are untouched — the admin must trigger
   * `POST .../collect-contributions` manually, per the per-group toggle
   * design.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async autoCollectDueCycles(): Promise<void> {
    this.logger.log('Running auto-collect job...');

    const now = new Date();

    const dueCycles = await this.cycleModel.find({
      status: CycleStatus.OPEN,
      dueDate: { $lte: now },
    });

    if (dueCycles.length === 0) {
      this.logger.log('Auto-collect job done. No due cycles found.');
      return;
    }

    let groupsProcessed = 0;

    for (const cycle of dueCycles) {
      try {
        const group = await this.groupModel.findById(cycle.group);

        if (
          !group ||
          group.status !== GroupStatus.ACTIVE ||
          !group.autoCollectEnabled
        ) {
          continue;
        }

        const results = await this.cyclesService.collectContributionsSystem(
          group,
          cycle,
        );
        groupsProcessed += 1;

        const successCount = results.filter((r) => r.success).length;
        this.logger.log(
          `Auto-collected for group ${group._id.toString()} cycle ${cycle.cycleNumber}: ${successCount}/${results.length} succeeded.`,
        );
      } catch (err) {
        this.logger.error(
          `Auto-collect failed for cycle ${cycle._id.toString()}: ${String(err)}`,
        );
      }
    }

    this.logger.log(
      `Auto-collect job done. ${dueCycles.length} due cycle(s) checked, ${groupsProcessed} group(s) processed.`,
    );
  }
}
