import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EscrowDepositDocument = EscrowDeposit & Document;

/**
 * Status of a single inbound bank transfer into a group's escrow DVA.
 *
 * UNALLOCATED -> the money has landed and the GroupWallet has been
 *                credited, but the admin hasn't yet attributed it to a
 *                specific member's contribution (e.g. the narration
 *                didn't carry the payment reference).
 * ALLOCATED   -> the admin linked it to a contribution and marked that
 *                contribution PAID.
 * IGNORED     -> the admin determined it isn't a valid contribution
 *                (e.g. wrong amount / not a group member).
 */
export enum EscrowDepositStatus {
  UNALLOCATED = 'unallocated',
  ALLOCATED = 'allocated',
  IGNORED = 'ignored',
}

/**
 * A settled bank transfer into the group's escrow Paystack Dedicated
 * Virtual Account, recorded from the `charge.success` webhook.
 *
 * The group's central wallet (GroupWallet) is credited with the deposit
 * as soon as it arrives, because the money is genuinely in the escrow
 * account. Attribution to a specific member's contribution happens
 * afterwards — automatically when the transfer narration carries the
 * member's `paymentReference`, otherwise manually by the group admin.
 */
@Schema({ timestamps: true })
export class EscrowDeposit {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group', required: true, index: true })
  group!: Types.ObjectId;

  /** The group's DVA number the transfer landed in. */
  @Prop({ index: true })
  escrowAccountNumber!: string;

  @Prop({ required: true, min: 1 })
  amount!: number;

  /**
   * Paystack's unique reference for the settled charge. Unique index
   * makes webhook re-delivery idempotent.
   */
  @Prop({ required: true, unique: true, index: true })
  providerReference!: string;

  /** Sender details as reported by Paystack (for admin reconciliation). */
  @Prop()
  senderName?: string;

  @Prop()
  senderBank?: string;

  /** The narration the sender put on the transfer, when Paystack gives it. */
  @Prop()
  narration?: string;

  @Prop({ required: true })
  receivedAt!: Date;

  @Prop({
    type: String,
    enum: EscrowDepositStatus,
    default: EscrowDepositStatus.UNALLOCATED,
  })
  status!: EscrowDepositStatus;

  @Prop({ type: Types.ObjectId, ref: 'Cycle' })
  cycle?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contribution' })
  contribution?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  allocatedBy?: Types.ObjectId;

  @Prop()
  allocatedAt?: Date;

  /** Raw Paystack payload, for debugging/auditing. */
  @Prop({ type: Object })
  rawPayload?: Record<string, unknown>;
}

export const EscrowDepositSchema = SchemaFactory.createForClass(EscrowDeposit);
