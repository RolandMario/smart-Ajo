import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PlatformSettingDocument = PlatformSetting & Document;

/** Singleton document key — the platform has exactly one settings row. */
export const PLATFORM_SETTING_KEY = 'platform';

/** Default % charged when a member transfers money from their wallet into escrow. */
export const DEFAULT_ESCROW_TRANSFER_FEE_PERCENT = 1;

/** Default % charged when pooled escrow money is paid out to a bank account. */
export const DEFAULT_PAYOUT_FEE_PERCENT = 2.5;

/**
 * Platform-wide configuration that a platform admin can change from the
 * admin console. A single row (`key: 'platform'`) holds the service
 * charges, so the rates apply to every group/pool immediately — unlike the
 * older per-group `Group.serviceFee` (a flat naira amount), these are
 * percentages of the amount moved.
 *
 *  - `escrowTransferFeePercent`: charged on wallet -> escrow transfers
 *    (member contributions and pool donations). Debited from the member's
 *    wallet on top of the amount that funds escrow.
 *  - `payoutFeePercent`: charged on bank payouts out of escrow (group
 *    cycle payouts and donation pool payouts). Deducted from the payout,
 *    i.e. the recipient receives `amount - fee`.
 *
 * Both are percentages (0-100, up to 2 decimal places) so a rate like
 * 2.5% is representable.
 */
@Schema({ timestamps: true })
export class PlatformSetting {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, default: PLATFORM_SETTING_KEY })
  key!: string;

  /** % of every wallet -> escrow transfer collected as a service charge. */
  @Prop({
    default: DEFAULT_ESCROW_TRANSFER_FEE_PERCENT,
    min: 0,
    max: 100,
  })
  escrowTransferFeePercent!: number;

  /** % of every bank payout collected as a service charge. */
  @Prop({ default: DEFAULT_PAYOUT_FEE_PERCENT, min: 0, max: 100 })
  payoutFeePercent!: number;

  /** The platform admin who last changed the rates. */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const PlatformSettingSchema =
  SchemaFactory.createForClass(PlatformSetting);
