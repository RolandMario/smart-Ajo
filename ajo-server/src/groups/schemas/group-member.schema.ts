import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { InviteStatus, PayoutStatus } from '../../common/enums/group.enum';

export type GroupMemberDocument = GroupMember & Document;

/**
 * Represents a user's membership in (or invitation to) a group.
 *
 * This is also where ALL per-group permissions live — `isGroupAdmin` is
 * the only authorization flag the app needs beyond the global
 * `platform_admin` role on User. A user can be `isGroupAdmin: true` on
 * one group and a plain member on another.
 */
@Schema({ timestamps: true })
export class GroupMember {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  group!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /**
   * True only for the user who created the group. Could later support
   * multiple admins per group, but for now there's exactly one.
   */
  @Prop({ default: false })
  isGroupAdmin!: boolean;

  @Prop({ type: String, enum: InviteStatus, default: InviteStatus.PENDING })
  inviteStatus!: InviteStatus;

  /**
   * Payout order position (1-indexed). Null until the rotation order is
   * locked (Group.status -> ORDER_LOCKED).
   */
  @Prop({ type: Number, default: null })
  position!: number | null;

  @Prop({ type: String, enum: PayoutStatus, default: PayoutStatus.PENDING })
  payoutStatus!: PayoutStatus;

  @Prop()
  invitedAt?: Date;

  @Prop()
  respondedAt?: Date;

  /**
   * Running count of contributions flagged DEFAULTED for this member
   * across the group's history (incremented by the defaulter sweep,
   * never decremented even if the contribution is later paid — it's a
   * historical "how many times has this person missed a due date"
   * counter for admin visibility, not a current-standing flag).
   */
  @Prop({ default: 0, min: 0 })
  defaultCount!: number;
}

export const GroupMemberSchema = SchemaFactory.createForClass(GroupMember);

// A user can only have one membership/invite record per group. When an
// invite is declined and the admin wants to re-invite, we update the
// existing document rather than creating a new one.
GroupMemberSchema.index({ group: 1, user: 1 }, { unique: true });
