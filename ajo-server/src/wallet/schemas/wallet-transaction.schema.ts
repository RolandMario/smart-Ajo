import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  WalletTransactionStatus,
  WalletTransactionType,
} from '../../common/enums/wallet.enum';

export type WalletTransactionDocument = WalletTransaction & Document;

/**
 * A single ledger entry for a Wallet. `amount` is always positive — the
 * direction (credit/debit) is implied by `type`. `balanceBefore` /
 * `balanceAfter` make the wallet's history independently auditable.
 */
@Schema({ timestamps: true })
export class WalletTransaction {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Wallet', required: true, index: true })
  wallet!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: WalletTransactionType, required: true })
  type!: WalletTransactionType;

  @Prop({
    type: String,
    enum: WalletTransactionStatus,
    default: WalletTransactionStatus.SUCCESS,
  })
  status!: WalletTransactionStatus;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, min: 0 })
  balanceBefore!: number;

  @Prop({ required: true, min: 0 })
  balanceAfter!: number;

  /**
   * Unique reference. For FUNDING entries this is the Paystack
   * transaction reference; for CONTRIBUTION_DEBIT entries it's an
   * internally generated reference.
   */
  @Prop({ required: true, unique: true })
  reference!: string;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  group?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Cycle' })
  cycle?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contribution' })
  contribution?: Types.ObjectId;

  /** Raw provider payload, for debugging/auditing. */
  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const WalletTransactionSchema =
  SchemaFactory.createForClass(WalletTransaction);
