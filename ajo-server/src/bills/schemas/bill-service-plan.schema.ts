import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type BillServicePlanDocument = BillServicePlan & Document;

/**
 * A single purchasable plan synced from the active provider for a given
 * service category. The admin can flip `isActive` to control whether the plan
 * is visible in the mobile app — off plans are never returned to members.
 *
 * Uniqueness is keyed on (serviceType, provider, externalId) so running a
 * sync repeatedly upserts instead of duplicating, while preserving the
 * admin's on/off toggles.
 */
@Schema({ timestamps: true })
export class BillServicePlan {
  _id!: Types.ObjectId;

  /** 'airtime' | 'data' | 'cable' | 'electricity' */
  @Prop({
    type: String,
    required: true,
    enum: ['airtime', 'data', 'cable', 'electricity'],
  })
  serviceType!: string;

  /** Which provider this plan originated from. VTPass is the only provider. */
  @Prop({ type: String, required: true, enum: ['vtpass'], default: 'vtpass' })
  provider!: string;

  /** The plan identifier as known by the provider (variation/cableplan/dataplan id). */
  @Prop({ type: String, required: true })
  externalId!: string;

  /** Display-friendly plan name (e.g. "MTN 1GB", "DStv Compact"). */
  @Prop({ type: String, required: true })
  name!: string;

  /** Network (airtime/data) or provider (cable) label this plan belongs to. */
  @Prop({ type: String, required: true })
  bucket!: string;

  /** Selling/cost amount in naira shown to the member. */
  @Prop({ type: Number, required: true, min: 0 })
  amount!: number;

  @Prop({ type: Boolean, default: true })
  fixedPrice!: boolean;

  /** Admin toggle — off plans are hidden from the mobile app. */
  @Prop({ type: Boolean, default: true, index: true })
  isActive!: boolean;

  /**
   * Share of the purchase amount returned to the member as cashback, in
   * percent (0–100, decimals allowed — `0.5` = half a percent).
   *
   * One row exists per sellable thing in every category, so this single field
   * configures data plans, airtime networks, cable bouquets (DSTV/GOtv/
   * StarTimes) and electricity discos alike. `0` (the default) means "no
   * cashback", so plans are opt-in.
   */
  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  cashbackPercent!: number;

  /** Any provider-specific extra fields worth preserving across syncs. */
  @Prop({ type: Object })
  meta?: Record<string, unknown>;
}

export const BillServicePlanSchema =
  SchemaFactory.createForClass(BillServicePlan);

BillServicePlanSchema.index(
  { serviceType: 1, provider: 1, externalId: 1 },
  { unique: true },
);
BillServicePlanSchema.index({ serviceType: 1, isActive: 1 });
