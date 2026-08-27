import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ContributionFrequency } from '../../common/enums/group.enum';
import {
  SavingDurationUnit,
  SavingPlanStatus,
} from '../../common/enums/saving.enum';

export type SavingPlanDocument = SavingPlan & Document;

/**
 * An individual savings plan. The system auto-debits the member's main
 * wallet at each interval (daily / weekly / monthly) into this plan's
 * `savingsBalance`. Once a full cycle (durationUnit + durationValue worth of
 * intervals, counted from the day the plan was created) has been collected
 * the plan completes and the user can withdraw the
 * accumulated amount to their saved bank account, then decide whether to
 * continue (start a new cycle) or delete the plan.
 */
@Schema({ timestamps: true })
export class SavingPlan {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  user!: Types.ObjectId;

  /** The purpose / name of the saving plan (e.g. "House rent"). */
  @Prop({ required: true, trim: true })
  name!: string;

  /** Amount (naira) to auto-debit at each interval. */
  @Prop({ required: true, min: 1 })
  amount!: number;

  @Prop({ type: String, enum: ContributionFrequency, required: true })
  frequency!: ContributionFrequency;

  /** The unit of the cycle length (days / months / years). */
  @Prop({ type: String, enum: SavingDurationUnit, required: true })
  durationUnit!: SavingDurationUnit;

  /** Number of `durationUnit`s the cycle lasts, counted from `startAt`. */
  @Prop({ required: true, min: 1 })
  durationValue!: number;

  /**
   * Legacy: nominal calendar length in months (3 / 6 / 12) for plans created
   * before `durationUnit`/`durationValue` existed. Kept so those plans keep
   * working (display + continue). Not set on new plans.
   */
  @Prop({ enum: [3, 6, 12] })
  durationMonths?: number;

  /**
   * Total number of intervals in one cycle, derived from
   * (frequency, durationUnit, durationValue) at creation — e.g. daily + 20
   * days => 20, monthly + 2 months => 2.
   */
  @Prop({ required: true, min: 1 })
  intervalCount!: number;

  /** 1-indexed. Incremented each time the user chooses to continue. */
  @Prop({ required: true, default: 1, min: 1 })
  cycleNumber!: number;

  /** Number of intervals successfully collected in the current cycle. */
  @Prop({ required: true, default: 0, min: 0 })
  collectedCount!: number;

  /** Accumulated amount saved in the current cycle (the withdrawable balance). */
  @Prop({ required: true, default: 0, min: 0 })
  savingsBalance!: number;

  /** Total saved across all cycles (informational). */
  @Prop({ required: true, default: 0, min: 0 })
  lifetimeSaved!: number;

  @Prop({
    type: String,
    enum: SavingPlanStatus,
    default: SavingPlanStatus.ACTIVE,
  })
  status!: SavingPlanStatus;

  /** Next moment the scheduler should auto-debit. */
  @Prop({ required: true })
  nextDueAt!: Date;

  @Prop({ required: true })
  startAt!: Date;

  /** When the current cycle is projected/known to be complete. */
  @Prop()
  endAt?: Date;

  /** When the last cycle's savings were paid out to the bank. */
  @Prop()
  withdrawnAt?: Date;

  /** When the plan was soft-deleted (user chose not to continue). */
  @Prop()
  deletedAt?: Date;

  /**
   * Reference of the most recent withdrawal attempt, so the Paystack
   * transfer webhook can match `transfer.*` events back to this plan.
   */
  @Prop()
  lastWithdrawalReference?: string;

  /** Used to throttle insufficient-balance notifications. */
  @Prop()
  lastInsufficientNotifiedAt?: Date;
}

export const SavingPlanSchema = SchemaFactory.createForClass(SavingPlan);

/**
 * Legacy plans created before `durationUnit`/`durationValue` existed carry only
 * the nominal `durationMonths` (3/6/12). Those two fields are required on the
 * schema, so any `plan.save()` on a legacy document (scheduler auto-debits,
 * continue, withdraw, delete) would fail Mongoose's full-document validation.
 * Normalise them here — just before validation — so those documents remain
 * usable without weakening the schema's guarantees for new plans.
 */
SavingPlanSchema.pre('validate', function (this: SavingPlanDocument) {
  if (this.durationUnit === undefined) {
    this.durationUnit = SavingDurationUnit.MONTHS;
  }
  if (this.durationValue === undefined) {
    this.durationValue = this.durationMonths ?? 3;
  }
});

SavingPlanSchema.index({ user: 1, status: 1 });
