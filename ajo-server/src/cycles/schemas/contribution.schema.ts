import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  ContributionPaymentMethod,
  ContributionStatus,
} from '../../common/enums/cycle.enum';

export type ContributionDocument = Contribution & Document;

/**
 * A single member's contribution toward a single cycle.
 *
 * One Contribution document is created per (cycle, member) pair when
 * the cycle is created. The MEMBER drives payment (self-serve):
 *
 *  - `payContributionFromWallet` debits their wallet and moves the
 *    contribution straight to PAID (paymentMethod = wallet).
 *  - `notifyBankTransferPayment` records that the member has sent a local
 *    bank transfer into the group's escrow Dedicated Virtual Account,
 *    debits the service fee from their wallet, and moves the
 *    contribution to AWAITING_CONFIRMATION. The group admin then calls
 *    `confirmContributionPaid` (-> PAID) or `rejectContributionPayment`
 *    (-> back to PENDING).
 *
 * If it's still PENDING after the cycle's dueDate passes, the defaulter
 * sweep flags it DEFAULTED — purely informational, no fee or suspension
 * is applied automatically. A contribution that is
 * AWAITING_CONFIRMATION is never flagged (the member has acted).
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
   * was paid / claimed. Used for audit trail and to know how much was
   * collected as a service fee. 0 while the contribution is unpaid.
   */
  @Prop({ default: 0, min: 0 })
  serviceFee!: number;

  @Prop({
    type: String,
    enum: ContributionStatus,
    default: ContributionStatus.PENDING,
  })
  status!: ContributionStatus;

  /** How the member paid (set on wallet payment or bank-transfer claim). */
  @Prop({ type: String, enum: ContributionPaymentMethod })
  paymentMethod?: ContributionPaymentMethod;

  /**
   * The narration/reference the member is asked to put on their bank
   * transfer (e.g. `AJO-3F9K2A-2`). Used to auto-match an inbound escrow
   * deposit to this contribution, and shown to the admin for manual
   * reconciliation.
   */
  @Prop({ index: true })
  paymentReference?: string;

  /** When the member tapped "I've paid – notify admin". */
  @Prop()
  paymentNotifiedAt?: Date;

  /** Optional reference/narration the member typed in when notifying. */
  @Prop()
  claimedTransferReference?: string;

  @Prop()
  paidAt?: Date;

  /** Group admin who confirmed the bank transfer (undefined for wallet). */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  confirmedBy?: Types.ObjectId;

  @Prop()
  confirmedAt?: Date;

  /** Set the last time the admin rejected a claimed bank transfer. */
  @Prop()
  lastRejectedAt?: Date;

  @Prop()
  lastRejectionReason?: string;

  /** Set the first time this contribution is flagged DEFAULTED. */
  @Prop()
  flaggedAt?: Date;
}

export const ContributionSchema = SchemaFactory.createForClass(Contribution);

// Exactly one contribution per (cycle, member).
ContributionSchema.index({ cycle: 1, member: 1 }, { unique: true });
