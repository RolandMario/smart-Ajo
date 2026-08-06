import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContributionStatus } from '../../common/enums/cycle.enum';

export type ContributionDocument = Contribution & Document;

/**
 * A single member's contribution toward a single cycle.
 *
 * One Contribution document is created per (cycle, member) pair when
 * the cycle is created. It moves PENDING -> PAID via the wallet-debit
 * flow in CyclesService.collectContributions. If it's still PENDING
 * after the cycle's dueDate passes, the defaulter sweep (Phase 6) flags
 * it DEFAULTED — purely informational, no fee or suspension is applied
 * automatically. A DEFAULTED contribution can still become PAID later
 * (e.g. the member tops up and the admin re-runs collection).
 */
@Schema({ timestamps: true })
export class Contribution {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  group!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cycle', required: true, index: true })
  cycle!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GroupMember', required: true })
  member!: Types.ObjectId;

  /** Denormalized for convenience when listing a member's own contributions. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Snapshot of the cycle's contributionAmount. */
  @Prop({ required: true, min: 1 })
  amount!: number;

  /**
   * Snapshot of the group's serviceFee at the time this contribution
   * was created. Used for audit trail and to know how much was
   * collected as a service fee when this contribution was paid.
   */
  @Prop({ default: 0, min: 0 })
  serviceFee!: number;

  @Prop({
    type: String,
    enum: ContributionStatus,
    default: ContributionStatus.PENDING,
  })
  status!: ContributionStatus;

  @Prop()
  paidAt?: Date;

  /** Set the first time this contribution is flagged DEFAULTED. */
  @Prop()
  flaggedAt?: Date;
}

export const ContributionSchema = SchemaFactory.createForClass(Contribution);

// Exactly one contribution per (cycle, member).
ContributionSchema.index({ cycle: 1, member: 1 }, { unique: true });
