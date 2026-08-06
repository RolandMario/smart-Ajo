import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ContributionFrequency,
  GroupStatus,
  RotationMethod,
} from '../../common/enums/group.enum';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  /**
   * The user who created this group. They are also the group's admin
   * (see GroupMember.isGroupAdmin) and count toward totalSlots.
   */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  createdBy!: Types.ObjectId;

  /**
   * Amount each member contributes per interval, in the smallest
   * currency unit handling is deferred to the payments phase — for now
   * this is a plain number (e.g. naira).
   */
  @Prop({ required: true, min: 1 })
  contributionAmount!: number;

  @Prop({
    type: String,
    enum: ContributionFrequency,
    default: ContributionFrequency.MONTHLY,
  })
  frequency!: ContributionFrequency;

  /**
   * Total number of members in the group, including the admin.
   * Fixed at creation time.
   */
  @Prop({ required: true, min: 2 })
  totalSlots!: number;

  /**
   * Chosen once by the admin at group creation. Determines how
   * `/groups/:id/rotation/lock` behaves: MANUAL requires an explicit
   * order, RANDOM shuffles accepted members server-side.
   */
  @Prop({ type: String, enum: RotationMethod, required: true })
  rotationMethod!: RotationMethod;

  @Prop({
    type: String,
    enum: GroupStatus,
    default: GroupStatus.OPEN_FOR_INVITES,
  })
  status!: GroupStatus;

  /**
   * Set when the rotation order is locked (Phase 2). The contribution
   * cycle engine (Phase 3) will use this as the basis for scheduling
   * the first cycle's due date.
   */
  @Prop()
  orderLockedAt?: Date;

  /**
   * Set when the group is activated (Phase 3) — the moment cycle 1 is
   * created and contributions begin.
   */
  @Prop()
  startDate?: Date;

  /**
   * 1-indexed cycle currently collecting contributions / awaiting
   * payout. Matches the `position` of the member due to collect.
   * Null until the group is activated; cleared (left at its final
   * value) once the group reaches COMPLETED.
   */
  @Prop({ type: Number, default: null })
  currentCycleNumber?: number | null;

  /**
   * When true, a daily scheduled job (AutoCollectScheduler) attempts to
   * debit every member's wallet for the current cycle's contribution
   * once its dueDate has arrived, without the admin needing to trigger
   * `POST .../collect-contributions` manually. Members with
   * insufficient balance are still just skipped (no fee/penalty) and
   * remain `pending`/`defaulted`. Defaults to false — admin must
   * explicitly opt in per group via `PATCH /groups/:id/auto-collect`.
   */
  @Prop({ default: false })
  autoCollectEnabled!: boolean;

  /**
   * Platform service fee per member per contribution, in the smallest
   * currency unit. Collected alongside the contribution amount when
   * contributions are collected. Goes to the platform admin's wallet.
   * Defaults to 0 (no fee).
   */
  @Prop({ default: 0, min: 0 })
  serviceFee!: number;
}

export const GroupSchema = SchemaFactory.createForClass(Group);
