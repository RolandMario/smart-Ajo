import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DonationMemberDocument = DonationMember & Document;

/**
 * Membership of a DonationGroup. Created for the admin at pool creation and
 * for everyone who joins by Group ID. The per-member totals are denormalised
 * so the pool detail can show "you have given ₦x" without aggregating the
 * whole donation collection.
 *
 * The unique {group, user} index is what makes "join" idempotent: a member
 * re-entering the Group ID simply lands back on their existing membership.
 */
@Schema({ timestamps: true })
export class DonationMember {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'DonationGroup',
    required: true,
    index: true,
  })
  group!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** Lifetime amount this member has donated to the pool. */
  @Prop({ required: true, default: 0, min: 0 })
  totalDonated!: number;

  /** Number of successful donations (one per period, max). */
  @Prop({ required: true, default: 0, min: 0 })
  donationCount!: number;

  @Prop()
  lastDonatedAt?: Date;

  @Prop({ required: true, default: () => new Date() })
  joinedAt!: Date;
}

export const DonationMemberSchema =
  SchemaFactory.createForClass(DonationMember);

DonationMemberSchema.index({ group: 1, user: 1 }, { unique: true });
DonationMemberSchema.index({ group: 1, joinedAt: 1 });
