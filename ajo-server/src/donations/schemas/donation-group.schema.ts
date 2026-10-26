import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  DonationAmountType,
  DonationFrequency,
  DonationGroupStatus,
  DonationSchedule,
} from '../../common/enums/donation.enum';
import type { DonationPayoutAccount } from './donation-payout-account.schema';
import { DonationPayoutAccountSchema } from './donation-payout-account.schema';

export type DonationGroupDocument = DonationGroup & Document;

/**
 * A donation pool ("Pool Collection"). One user (the admin) creates it and
 * shares its short `joinCode`; members join and donate from their Ajo wallet.
 * Every donation lands in the pool's escrow (`escrowBalance`) and the admin
 * pays the collected money out to their own bank account (or to the
 * `payoutAccount` override set on the pool).
 *
 * Unlike a rotating Ajo circle there is no rotation and no payout schedule:
 * money is donated per period (see `donation-period.ts`) and the admin
 * withdraws whenever they like.
 */
@Schema({ timestamps: true })
export class DonationGroup {
  _id!: Types.ObjectId;

  /** Pool title, e.g. "Chidi's Wedding Fund". */
  @Prop({ required: true, trim: true, maxlength: 100 })
  name!: string;

  /** What the money is for — shown on the pool detail screen. */
  @Prop({ required: true, trim: true, maxlength: 300 })
  purpose!: string;

  @Prop({ type: String, enum: DonationAmountType, required: true })
  amountType!: DonationAmountType;

  /** Donation amount per period when `amountType` is FIXED. */
  @Prop({ min: 100 })
  amount?: number;

  @Prop({ type: String, enum: DonationSchedule, required: true })
  schedule!: DonationSchedule;

  /** Cadence of an INTERVAL pool; unset for ONE_TIME pools. */
  @Prop({ type: String, enum: DonationFrequency })
  frequency?: DonationFrequency;

  /**
   * Short, shareable "Group ID" (same alphabet/rules as circle groups — see
   * `groups/join-code.ts`). Members type this on the Join Pool screen; it is
   * unique across all donation pools.
   */
  @Prop({
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  joinCode!: string;

  /** The pool owner — the only member allowed to pay out. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  admin!: Types.ObjectId;

  @Prop({
    type: String,
    enum: DonationGroupStatus,
    default: DonationGroupStatus.ACTIVE,
  })
  status!: DonationGroupStatus;

  /** Money collected but not yet paid out — the pool's escrow. */
  @Prop({ required: true, default: 0, min: 0 })
  escrowBalance!: number;

  /** Lifetime donations received (never decreases). */
  @Prop({ required: true, default: 0, min: 0 })
  totalCollected!: number;

  /** Lifetime amount successfully transferred to the admin. */
  @Prop({ required: true, default: 0, min: 0 })
  totalPaidOut!: number;

  /** Members in the pool, admin included. */
  @Prop({ required: true, default: 1, min: 1 })
  memberCount!: number;

  /**
   * Distinct members who have donated at least once. "Donors" is a
   * different number from members — people join without giving.
   */
  @Prop({ required: true, default: 0, min: 0 })
  donorCount!: number;

  /**
   * Optional payout destination chosen by the admin. When absent the admin's
   * own saved `User.bankAccount` is used.
   */
  @Prop({ type: DonationPayoutAccountSchema })
  payoutAccount?: DonationPayoutAccount;

  @Prop()
  lastDonationAt?: Date;

  @Prop()
  lastPayoutAt?: Date;

  /**
   * Members who have voted for the pool to be terminated. Only members who
   * have made 100% of their payment towards the pool may vote
   * (see `DonationsService`), and the vote is a toggle — pulling the id back
   * out withdraws the vote.
   */
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  terminationVotes!: Types.ObjectId[];

  /**
   * Set when the pool was terminated: 2/3 of the fully paid members voted
   * yes, every naira donated had been paid out, and the admin confirmed.
   * Terminated pools accept no new members or donations.
   */
  @Prop()
  terminatedAt?: Date;

  /** The pool admin who pressed the terminate button. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  terminatedBy?: Types.ObjectId;
}

export const DonationGroupSchema = SchemaFactory.createForClass(DonationGroup);

DonationGroupSchema.index({ admin: 1, createdAt: -1 });
