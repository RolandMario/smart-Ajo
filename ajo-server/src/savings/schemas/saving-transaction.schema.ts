import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { SavingTransactionType } from '../../common/enums/saving.enum';

export type SavingTransactionDocument = SavingTransaction & Document;

/**
 * Plan-scoped audit ledger for a SavingPlan. `amount` is always positive;
 * the direction is implied by `type`.
 */
@Schema({ timestamps: true })
export class SavingTransaction {
  _id!: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'SavingPlan',
    required: true,
    index: true,
  })
  plan!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  @Prop({ type: String, enum: SavingTransactionType, required: true })
  type!: SavingTransactionType;

  @Prop({ required: true, min: 0 })
  amount!: number;

  /** Unique reference — used for idempotency and Paystack webhook matching. */
  @Prop({ required: true, unique: true })
  reference!: string;

  /** Which cycle of the plan this entry belongs to. */
  @Prop({ required: true, min: 1 })
  cycleNumber!: number;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;
}

export const SavingTransactionSchema =
  SchemaFactory.createForClass(SavingTransaction);
