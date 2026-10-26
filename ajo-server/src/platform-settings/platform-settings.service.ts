import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  DEFAULT_ESCROW_TRANSFER_FEE_PERCENT,
  DEFAULT_PAYOUT_FEE_PERCENT,
  PLATFORM_SETTING_KEY,
  PlatformSetting,
  PlatformSettingDocument,
} from './schemas/platform-setting.schema';
import { UpdateServiceChargesDto } from './dto/update-service-charges.dto';

/** The two platform-wide service charges, as percentages. */
export interface ServiceCharges {
  escrowTransferFeePercent: number;
  payoutFeePercent: number;
}

/**
 * Reads and writes the platform's service-charge configuration and turns
 * the percentages into naira amounts.
 *
 * Every money-moving path (contributions, pool donations, group payouts,
 * pool payouts) asks this service for the current rate at the moment of
 * the transfer, so a rate change by a platform admin applies to the very
 * next transfer without touching group settings.
 *
 * Reads are cheap and uncached — a stale cached rate could charge the
 * wrong amount on a payout, which is much worse than one small DB read
 * per money movement.
 */
@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(
    @InjectModel(PlatformSetting.name)
    private settingModel: Model<PlatformSettingDocument>,
  ) {}

  // ---- Configuration ---------------------------------------------------------

  async getServiceCharges(): Promise<ServiceCharges> {
    const setting = await this.loadOrCreate();

    return {
      escrowTransferFeePercent: setting.escrowTransferFeePercent,
      payoutFeePercent: setting.payoutFeePercent,
    };
  }

  /**
   * Updates one or both rates. Fields left out of `dto` keep their current
   * value; `updatedBy` is recorded for the audit trail.
   */
  async updateServiceCharges(
    dto: UpdateServiceChargesDto,
    updatedBy?: string,
  ): Promise<ServiceCharges> {
    const setting = await this.loadOrCreate();

    if (dto.escrowTransferFeePercent !== undefined) {
      setting.escrowTransferFeePercent = dto.escrowTransferFeePercent;
    }
    if (dto.payoutFeePercent !== undefined) {
      setting.payoutFeePercent = dto.payoutFeePercent;
    }
    if (updatedBy) {
      setting.updatedBy = new Types.ObjectId(updatedBy);
    }

    await setting.save();

    this.logger.log(
      `Service charges updated: escrow transfer ${setting.escrowTransferFeePercent}%, ` +
        `payout ${setting.payoutFeePercent}% (by ${updatedBy ?? 'unknown'})`,
    );

    return {
      escrowTransferFeePercent: setting.escrowTransferFeePercent,
      payoutFeePercent: setting.payoutFeePercent,
    };
  }

  // ---- Fee maths -------------------------------------------------------------

  /**
   * Rounds a percentage of `amount` to whole naira.
   *
   * Naira has no minor unit in this system (every amount is an integer),
   * so a 2.5% fee on ₦250 (₦6.25) is charged as ₦6. The fee is capped at
   * the amount itself, so a 100% rate can never ask for more money than
   * the transfer carries.
   */
  calculateFee(amount: number, percent: number): number {
    if (!Number.isFinite(amount) || !Number.isFinite(percent)) return 0;
    if (amount <= 0 || percent <= 0) return 0;

    const fee = Math.round((amount * percent) / 100);

    return Math.min(Math.max(fee, 0), Math.floor(amount));
  }

  /** Charge for moving `amount` naira from a wallet into escrow. */
  async calculateEscrowTransferFee(amount: number): Promise<number> {
    const { escrowTransferFeePercent } = await this.getServiceCharges();

    return this.calculateFee(amount, escrowTransferFeePercent);
  }

  /** Charge for paying `amount` naira out of escrow to a bank account. */
  async calculatePayoutFee(amount: number): Promise<number> {
    const { payoutFeePercent } = await this.getServiceCharges();

    return this.calculateFee(amount, payoutFeePercent);
  }

  // ---- Internals -------------------------------------------------------------

  /**
   * Returns the singleton settings row, creating it with the defaults the
   * first time it is read (upsert makes this race-safe).
   */
  private async loadOrCreate(): Promise<PlatformSettingDocument> {
    const setting = await this.settingModel.findOneAndUpdate(
      { key: PLATFORM_SETTING_KEY },
      {
        $setOnInsert: {
          key: PLATFORM_SETTING_KEY,
          escrowTransferFeePercent: DEFAULT_ESCROW_TRANSFER_FEE_PERCENT,
          payoutFeePercent: DEFAULT_PAYOUT_FEE_PERCENT,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    if (!setting) {
      // Practically unreachable (upsert + new), but the money paths must
      // never crash on a missing config row.
      this.logger.warn(
        'Platform settings row could not be loaded; falling back to defaults.',
      );
      return {
        escrowTransferFeePercent: DEFAULT_ESCROW_TRANSFER_FEE_PERCENT,
        payoutFeePercent: DEFAULT_PAYOUT_FEE_PERCENT,
      } as PlatformSettingDocument;
    }

    return setting;
  }
}
