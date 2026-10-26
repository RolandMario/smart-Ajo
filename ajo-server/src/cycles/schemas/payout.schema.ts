import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TransferStatus } from '../../common/enums/wallet.enum';

export type PayoutDocument = Payout & Document;

/**
 * A single transfer of pooled funds to a cycle's recipient, initiated by
 * the group admin via `POST /groups/:id/cycles/:cycleId/payout`.
 *
 * One Payout per Cycle (enforced by the unique index below). If a
 * transfer fails, the SAME Payout document is updated on retry rather
 * than creating a new one — `paystackReference` changes per attempt.
 */
@Schema({ timestamps: true })
export class Payout {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  group!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cycle', required: true })
  cycle!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'GroupMember', required: true })
  recipientMember!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  recipientUser!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  initiatedBy!: Types.ObjectId;

  /** Total pooled amount for this cycle (contributionAmount * totalSlots). */
  @Prop({ required: true, min: 1 })
  amount!: number;

  /**
   * Platform payout service charge taken out of `amount` (see
   * PlatformSetting.payoutFeePercent). The group's central account is
   * debited the full `amount`; the recipient receives `netAmount`.
   */
  @Prop({ default: 0, min: 0 })
  fee!: number;

  /**
   * `amount - fee` — what actually reaches the recipient's bank account.
   *
   * Not `required`: payouts created before platform fees existed have no
   * value stored, and finalizing one must still succeed. Reads fall back
   * to `amount`, which is what those payouts were sent as.
   */
  @Prop({ default: 0, min: 0 })
  netAmount!: number;

  @Prop({ type: String, enum: TransferStatus, default: TransferStatus.PENDING })
  status!: TransferStatus;

  @Prop()
  paystackTransferCode?: string;

  /** Our generated reference for the current/most recent transfer attempt. */
  @Prop({ required: true })
  paystackReference!: string;

  @Prop()
  failureReason?: string;

  @Prop()
  completedAt?: Date;
}

export const PayoutSchema = SchemaFactory.createForClass(Payout);

PayoutSchema.index({ cycle: 1 }, { unique: true });
