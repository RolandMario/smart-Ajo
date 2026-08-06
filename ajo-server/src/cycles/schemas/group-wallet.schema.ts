import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupWalletDocument = GroupWallet & Document;

/**
 * A group's "central account" — the pooled balance of member
 * contributions awaiting payout to the current cycle's recipient.
 *
 * In a healthy group this returns to 0 after every payout (it's credited
 * by each member's CONTRIBUTION_DEBIT and debited by the cycle's
 * PAYOUT_DEBIT for the same total amount).
 */
@Schema({ timestamps: true })
export class GroupWallet {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true })
  group!: Types.ObjectId;

  @Prop({ required: true, default: 0, min: 0 })
  balance!: number;
}

export const GroupWalletSchema = SchemaFactory.createForClass(GroupWallet);

GroupWalletSchema.index({ group: 1 }, { unique: true });
