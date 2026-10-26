import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A payout bank account stored on a DonationGroup. Mirrors
 * `User.bankAccount` (BankAccount) so the payout code can treat both
 * interchangeably; `paystackRecipientCode` is what Paystack actually needs.
 *
 * Only set when the pool admin overrides the destination — otherwise the
 * admin's own saved bank account is used at payout time.
 */
@Schema({ _id: false, timestamps: false })
export class DonationPayoutAccount {
  @Prop({ required: true })
  bankCode!: string;

  @Prop({ required: true })
  bankName!: string;

  @Prop({ required: true })
  accountNumber!: string;

  /** Verified account holder name, returned by Paystack's resolution call. */
  @Prop({ required: true })
  accountName!: string;

  /** Paystack transfer recipient code, reused for future payouts. */
  @Prop({ required: true })
  paystackRecipientCode!: string;
}

export const DonationPayoutAccountSchema = SchemaFactory.createForClass(
  DonationPayoutAccount,
);
