import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A member's payout bank account, embedded on User. Set via
 * `POST /wallet/bank-account`, which resolves the account name through
 * Paystack and creates a Paystack transfer recipient — `recipientCode`
 * is what's actually used when initiating a payout.
 */
@Schema({ _id: false, timestamps: false })
export class BankAccount {
  @Prop({ required: true })
  bankCode!: string;

  @Prop({ required: true })
  bankName!: string;

  @Prop({ required: true })
  accountNumber!: string;

  /** Returned by Paystack's account resolution — the verified account holder's name. */
  @Prop({ required: true })
  accountName!: string;

  /** Paystack transfer recipient code, reused for all future payouts to this user. */
  @Prop({ required: true })
  paystackRecipientCode!: string;
}

export const BankAccountSchema = SchemaFactory.createForClass(BankAccount);
