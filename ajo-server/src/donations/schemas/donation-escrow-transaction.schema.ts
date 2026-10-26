import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { DonationEscrowTransactionType } from '../../common/enums/donation.enum';

export type DonationEscrowTransactionDocument = DonationEscrowTransaction &
  Document;

/**
 * Pool-scoped ledger — every movement in or out of `DonationGroup
 * .escrowBalance`, in order. `amount` is always positive; the direction is
 * implied by `type`. `balanceBefore` / `balanceAfter` make the history
 * auditable without replaying it.
 *
 * Rows are written only inside the same Mongo transaction that moves the
 * money, so the ledger and the group balance can never disagree.
 */
@Schema({ timestamps: true })
export class DonationEscrowTransaction {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'DonationGroup',
    required: true,
    index: true,
  })
  group!: Types.ObjectId;

  @Prop({
    type: String,
    enum: DonationEscrowTransactionType,
    required: true,
  })
  type!: DonationEscrowTransactionType;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, min: 0 })
  balanceBefore!: number;

  @Prop({ required: true, min: 0 })
  balanceAfter!: number;

  @Prop({ type: Types.ObjectId, ref: 'Donation' })
  donation?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'DonationPayout' })
  payout?: Types.ObjectId;

  /** Wallet reference (donations) or payout reference (payouts). */
  @Prop({ required: true })
  reference!: string;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const DonationEscrowTransactionSchema = SchemaFactory.createForClass(
  DonationEscrowTransaction,
);

DonationEscrowTransactionSchema.index({ group: 1, createdAt: -1 });
