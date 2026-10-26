import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TransferStatus } from '../../common/enums/wallet.enum';

export type DonationPayoutDocument = DonationPayout & Document;

/**
 * One escrow payout from a DonationGroup to the admin's bank account.
 *
 * Mirrors `Payout` (cycles): the row is created PENDING while the Paystack
 * transfer is in flight, and finalised by `DonationsService
 * .completePayout` — either inline (test mode / immediate success) or later
 * from the `transfer.success` webhook. `group` + `paystackReference` is what
 * the webhook uses to find the row.
 *
 * The destination bank details are snapshotted here so the payout history
 * still reads correctly after the admin changes their bank account.
 */
@Schema({ timestamps: true })
export class DonationPayout {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'DonationGroup',
    required: true,
    index: true,
  })
  group!: Types.ObjectId;

  /** The pool admin who asked for the payout. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  initiatedBy!: Types.ObjectId;

  /** Naira amount leaving escrow. */
  @Prop({ required: true, min: 1 })
  amount!: number;

  /**
   * Platform payout service charge taken out of `amount` (see
   * PlatformSetting.payoutFeePercent). Escrow is debited the full `amount`;
   * the admin's bank account receives `netAmount`.
   */
  @Prop({ default: 0, min: 0 })
  fee!: number;

  /**
   * `amount - fee` — what actually reaches the bank account.
   *
   * Not `required`: payouts created before platform fees existed have no
   * value stored, and finalizing one must still succeed. Reads fall back
   * to `amount`, which is what those payouts were sent as.
   */
  @Prop({ default: 0, min: 0 })
  netAmount!: number;

  @Prop({
    type: String,
    enum: TransferStatus,
    default: TransferStatus.PENDING,
  })
  status!: TransferStatus;

  /** Unique reference handed to Paystack; also the webhook lookup key. */
  @Prop({ required: true, unique: true })
  paystackReference!: string;

  @Prop()
  paystackTransferCode?: string;

  @Prop({ required: true })
  bankName!: string;

  @Prop({ required: true })
  accountNumber!: string;

  @Prop({ required: true })
  accountName!: string;

  @Prop()
  failureReason?: string;

  @Prop()
  completedAt?: Date;
}

export const DonationPayoutSchema =
  SchemaFactory.createForClass(DonationPayout);

DonationPayoutSchema.index({ group: 1, createdAt: -1 });
DonationPayoutSchema.index({ group: 1, status: 1 });
