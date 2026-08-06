import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CycleStatus } from '../../common/enums/cycle.enum';

export type CycleDocument = Cycle & Document;

/**
 * One rotation of contributions for a group — i.e. the period during
 * which all members contribute toward a single payout.
 *
 * `cycleNumber` matches the `position` of the GroupMember who is due to
 * collect (recipientMember). Cycle 1 is created when the group is
 * activated; subsequent cycles are created automatically when the
 * previous cycle's payout is initiated.
 */
@Schema({ timestamps: true })
export class Cycle {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  group!: Types.ObjectId;

  /** 1-indexed. Matches recipientMember.position. */
  @Prop({ required: true, min: 1 })
  cycleNumber!: number;

  @Prop({ type: Types.ObjectId, ref: 'GroupMember', required: true })
  recipientMember!: Types.ObjectId;

  /**
   * Snapshot of Group.contributionAmount at the time this cycle was
   * created — protects historical cycles if group settings ever
   * become editable in the future.
   */
  @Prop({ required: true, min: 1 })
  contributionAmount!: number;

  /** Snapshot of Group.totalSlots at creation time. */
  @Prop({ required: true, min: 2 })
  totalSlots!: number;

  @Prop({ required: true })
  dueDate!: Date;

  @Prop({ type: String, enum: CycleStatus, default: CycleStatus.OPEN })
  status!: CycleStatus;

  @Prop()
  completedAt?: Date;
}

export const CycleSchema = SchemaFactory.createForClass(Cycle);

// Exactly one cycle per (group, cycleNumber).
CycleSchema.index({ group: 1, cycleNumber: 1 }, { unique: true });
