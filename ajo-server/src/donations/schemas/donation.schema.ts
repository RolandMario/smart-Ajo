import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DonationDocument = Donation & Document;

/**
 * A single successful donation into a pool.
 *
 * `period` is the calendar bucket the donation counts against (`2026-10-25`,
 * `2026-W43`, `2026-10`, `2026`, or `once` for one-time pools). Together with
 * `group` + `user` it is unique, which enforces "one donation per member per
 * period" at the database level even under concurrent requests.
 *
 * `reference` is deterministic (`don_<groupId>_<userId>_<period>`) and unique.
 * It is used twice: as the idempotency key for the wallet debit (the same
 * shape as SavingsService's interval payments) and as the key the escrow
 * ledger row is written with, so a duplicate request aborts before money
 * moves.
 */
@Schema({ timestamps: true })
export class Donation {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'DonationGroup',
    required: true,
    index: true,
  })
  group!: Types.ObjectId;

  /** The donor's membership row in this pool. */
  @Prop({ type: Types.ObjectId, ref: 'DonationMember', required: true })
  member!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  amount!: number;

  /**
   * Platform escrow-transfer service charge debited on top of `amount`
   * (see PlatformSetting.escrowTransferFeePercent). `amount` is what funds
   * the pool's escrow; the fee goes to the platform admin's wallet.
   */
  @Prop({ default: 0, min: 0 })
  serviceFee!: number;

  /** Period bucket, see `utils/donation-period.ts`. */
  @Prop({ required: true })
  period!: string;

  /** Unique, deterministic wallet/escrow reference. */
  @Prop({ required: true, unique: true })
  reference!: string;
}

export const DonationSchema = SchemaFactory.createForClass(Donation);

DonationSchema.index({ group: 1, user: 1, period: 1 }, { unique: true });
DonationSchema.index({ group: 1, createdAt: -1 });
DonationSchema.index({ user: 1, createdAt: -1 });
