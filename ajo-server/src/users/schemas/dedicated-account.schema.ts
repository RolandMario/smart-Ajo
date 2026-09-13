import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

/**
 * A member's Paystack Dedicated Virtual Account (DVA) — a personal bank
 * account number they can transfer money into to fund their Ajo wallet.
 *
 * Created lazily on first access (GET /wallet/dedicated-account) using the
 * member's verified phone number. Paystack assigns the account number
 * (the phone is used to create the Paystack customer and to reconcile
 * inbound transfers via the `charge.success` webhook).
 */
@Schema({ _id: false, timestamps: false })
export class DedicatedAccount {
  /** Paystack customer code (CUS_xxx) the DVA is attached to. */
  @Prop()
  paystackCustomerCode?: string;

  /**
   * Paystack's numeric id for the dedicated account, when returned by the
   * API. Used to deactivate the account when a refresh is requested.
   */
  @Prop()
  paystackAccountId?: string;

  /** The 10-digit virtual account number members transfer into. */
  @Prop()
  accountNumber?: string;

  /** Account name Paystack generated, e.g. "Jane Doe/9989123". */
  @Prop()
  accountName?: string;

  /** Bank the virtual account sits with (e.g. "Wema Bank"). */
  @Prop()
  bankName?: string;

  @Prop({ default: 'paystack' })
  provider!: string;

  @Prop({ default: 'NGN' })
  currency!: string;

  /** False once deactivated (refresh); a new number may then be assigned. */
  @Prop({ default: true })
  active!: boolean;
}

export const DedicatedAccountSchema =
  SchemaFactory.createForClass(DedicatedAccount);
