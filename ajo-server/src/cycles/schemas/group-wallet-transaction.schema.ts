import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { GroupWalletTransactionType } from '../../common/enums/wallet.enum';

export type GroupWalletTransactionDocument = GroupWalletTransaction & Document;

/**
 * A single ledger entry for a GroupWallet (central account).
 */
@Schema({ timestamps: true })
export class GroupWalletTransaction {
  _id: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'GroupWallet',
    required: true,
    index: true,
  })
  groupWallet!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  group!: Types.ObjectId;

  @Prop({ type: String, enum: GroupWalletTransactionType, required: true })
  type!: GroupWalletTransactionType;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true, min: 0 })
  balanceBefore!: number;

  @Prop({ required: true, min: 0 })
  balanceAfter!: number;

  @Prop({ type: Types.ObjectId, ref: 'Cycle' })
  cycle?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contribution' })
  contribution?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payout' })
  payout?: Types.ObjectId;
}

export const GroupWalletTransactionSchema = SchemaFactory.createForClass(
  GroupWalletTransaction,
);
