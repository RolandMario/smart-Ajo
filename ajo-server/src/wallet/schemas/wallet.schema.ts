import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WalletDocument = Wallet & Document;

/**
 * A member's personal wallet. Funded via Paystack
 * (`POST /wallet/fund/initialize`); automatically debited for cycle
 * contributions (see CyclesService).
 *
 * Balance is stored in NAIRA (major unit) as a number, matching
 * `Group.contributionAmount`. Paystack amounts (kobo) are converted at
 * the PaystackService boundary only.
 */
@Schema({ timestamps: true })
export class Wallet {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ required: true, default: 0, min: 0 })
  balance!: number;

  @Prop({ default: 'NGN' })
  currency!: string;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

WalletSchema.index({ user: 1 }, { unique: true });
