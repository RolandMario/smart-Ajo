import { Types } from 'mongoose';
import { PlatformSettingsService } from './platform-settings.service';
import {
  DEFAULT_ESCROW_TRANSFER_FEE_PERCENT,
  DEFAULT_PAYOUT_FEE_PERCENT,
  PLATFORM_SETTING_KEY,
} from './schemas/platform-setting.schema';

const ADMIN_ID = new Types.ObjectId().toString();

type SettingStub = ReturnType<typeof makeSetting>;

function makeSetting(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    key: PLATFORM_SETTING_KEY,
    escrowTransferFeePercent: DEFAULT_ESCROW_TRANSFER_FEE_PERCENT,
    payoutFeePercent: DEFAULT_PAYOUT_FEE_PERCENT,
    updatedBy: undefined as Types.ObjectId | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildService(setting: SettingStub | null = makeSetting()) {
  const settingModel = {
    findOneAndUpdate: jest.fn().mockResolvedValue(setting),
  };

  const service = new PlatformSettingsService(settingModel as never);

  // `setting` is non-null for every test that inspects the row it passed in
  // (only the "cannot be loaded" test passes null).
  return { service, settingModel, setting: setting as SettingStub };
}

describe('PlatformSettingsService', () => {
  describe('reading the configured rates', () => {
    it('creates the singleton row with the defaults on first read', async () => {
      const { service, settingModel } = buildService();

      const charges = await service.getServiceCharges();

      expect(settingModel.findOneAndUpdate).toHaveBeenCalledWith(
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
      // 1% on transfers, 2.5% on payouts.
      expect(charges).toEqual({
        escrowTransferFeePercent: 1,
        payoutFeePercent: 2.5,
      });
    });

    it('returns the stored rates when an admin has changed them', async () => {
      const { service } = buildService(
        makeSetting({
          escrowTransferFeePercent: 3,
          payoutFeePercent: 0,
        }),
      );

      await expect(service.getServiceCharges()).resolves.toEqual({
        escrowTransferFeePercent: 3,
        payoutFeePercent: 0,
      });
    });

    it('falls back to the defaults when the row cannot be loaded', async () => {
      const { service } = buildService(null);

      await expect(service.getServiceCharges()).resolves.toEqual({
        escrowTransferFeePercent: DEFAULT_ESCROW_TRANSFER_FEE_PERCENT,
        payoutFeePercent: DEFAULT_PAYOUT_FEE_PERCENT,
      });
    });
  });

  describe('updating the rates', () => {
    it('changes only the supplied rate and records who changed it', async () => {
      const { service, setting } = buildService();

      const charges = await service.updateServiceCharges(
        { payoutFeePercent: 4 },
        ADMIN_ID,
      );

      expect(charges).toEqual({
        escrowTransferFeePercent: 1,
        payoutFeePercent: 4,
      });
      expect(setting.escrowTransferFeePercent).toBe(1);
      expect(setting.updatedBy?.toString()).toBe(ADMIN_ID);
      expect(setting.save).toHaveBeenCalledTimes(1);
    });

    it('accepts a zero rate (service charge switched off)', async () => {
      const { service } = buildService();

      const charges = await service.updateServiceCharges({
        escrowTransferFeePercent: 0,
        payoutFeePercent: 0,
      });

      expect(charges).toEqual({
        escrowTransferFeePercent: 0,
        payoutFeePercent: 0,
      });
    });

    it('leaves updatedBy untouched when no actor is supplied', async () => {
      const { service, setting } = buildService(
        makeSetting({ updatedBy: undefined }),
      );

      await service.updateServiceCharges({ payoutFeePercent: 2 });

      expect(setting.updatedBy).toBeUndefined();
    });
  });

  describe('fee maths', () => {
    it('rounds the percentage to whole naira', () => {
      const { service } = buildService();

      // 2.5% of ₦250 = ₦6.25 → ₦6 (naira has no minor unit here).
      expect(service.calculateFee(250, 2.5)).toBe(6);
      // 1% of ₦1,000 = ₦10.
      expect(service.calculateFee(1000, 1)).toBe(10);
      // 1% of ₦50 = ₦0.50 → ₦1.
      expect(service.calculateFee(50, 1)).toBe(1);
    });

    it('never charges more than the amount being moved', () => {
      const { service } = buildService();

      expect(service.calculateFee(1000, 100)).toBe(1000);
      expect(service.calculateFee(1000, 250)).toBe(1000);
    });

    it('charges nothing for a zero rate or a non-positive amount', () => {
      const { service } = buildService();

      expect(service.calculateFee(1000, 0)).toBe(0);
      expect(service.calculateFee(0, 5)).toBe(0);
      expect(service.calculateFee(-100, 5)).toBe(0);
      expect(service.calculateFee(Number.NaN, 5)).toBe(0);
      expect(service.calculateFee(1000, Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('uses the transfer rate for wallet -> escrow fees', async () => {
      const { service } = buildService(
        makeSetting({ escrowTransferFeePercent: 1.5, payoutFeePercent: 5 }),
      );

      await expect(service.calculateEscrowTransferFee(2000)).resolves.toBe(30);
    });

    it('uses the payout rate for bank payout fees', async () => {
      const { service } = buildService(
        makeSetting({ escrowTransferFeePercent: 9, payoutFeePercent: 2.5 }),
      );

      await expect(service.calculatePayoutFee(5000)).resolves.toBe(125);
    });
  });
});
