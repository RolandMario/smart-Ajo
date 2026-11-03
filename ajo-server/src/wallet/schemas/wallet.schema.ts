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

  /**
   * Cashback the member has earned on bill purchases. Kept separate from
   * `balance` so it can be surfaced as its own wallet on the profile screen,
   * and so a bill can be paid straight out of it (`paymentSource:
   * 'cashback'`). Funded only by `WalletService.creditBillCashback`, never by
   * Paystack.
   */
  @Prop({ type: Number, default: 0, min: 0 })
  cashbackBalance!: number;

  @Prop({ default: 'NGN' })
  currency!: string;
}

export const WalletSchema = SchemaFactory.createForClass(Wallet);

WalletSchema.index({ user: 1 }, { unique: true });
