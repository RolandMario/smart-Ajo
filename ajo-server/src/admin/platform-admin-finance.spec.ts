import { Types } from 'mongoose';
import { PlatformAdminFinanceService } from './platform-admin-finance.service';
import {
  WalletTransactionStatus,
  WalletTransactionType,
} from '../common/enums/wallet.enum';

/**
 * Focused unit tests for the Service Charges tab's totals
 * (`GET /admin/finance/service-charge-totals`). The method is a single
 * aggregation over the platform admin's WalletTransaction ledger, so we
 * stub `aggregate` and assert on both the pipeline and the arithmetic.
 */

const ADMIN_ID = new Types.ObjectId();

function buildService(aggregate: jest.Mock) {
  const usersService = {
    findPlatformAdmin: jest.fn().mockResolvedValue({ _id: ADMIN_ID }),
  };

  const service = new PlatformAdminFinanceService(
    { aggregate } as never,
    {} as never,
    {} as never,
    {} as never,
    usersService as never,
  );

  return { service, usersService };
}

describe('PlatformAdminFinanceService.getServiceChargeTotals', () => {
  it('nets reversed fees off the fees collected', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValue([
        {
          _id: WalletTransactionType.SERVICE_FEE_CREDIT,
          total: 12_500,
          count: 7,
        },
        {
          _id: WalletTransactionType.SERVICE_FEE_DEBIT,
          total: 1_500,
          count: 2,
        },
      ]),
    );

    await expect(service.getServiceChargeTotals()).resolves.toEqual({
      totalCollected: 12_500,
      totalReversed: 1_500,
      netCollected: 11_000,
      chargeCount: 7,
    });
  });

  it('scopes the aggregation to the platform admin and successful fee entries', async () => {
    const aggregate = jest.fn().mockResolvedValue([]);
    const { service, usersService } = buildService(aggregate);

    await service.getServiceChargeTotals();

    expect(usersService.findPlatformAdmin).toHaveBeenCalledTimes(1);

    const pipeline = (
      aggregate.mock.calls as unknown as Array<[Array<Record<string, unknown>>]>
    )[0][0];

    expect(pipeline[0]).toEqual({
      $match: {
        user: ADMIN_ID,
        status: WalletTransactionStatus.SUCCESS,
        type: {
          $in: [
            WalletTransactionType.SERVICE_FEE_CREDIT,
            WalletTransactionType.SERVICE_FEE_DEBIT,
          ],
        },
      },
    });

    expect(pipeline[1]).toEqual({
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    });
  });

  it('returns a zeroed balance when no fees have been collected', async () => {
    const { service } = buildService(jest.fn().mockResolvedValue([]));

    await expect(service.getServiceChargeTotals()).resolves.toEqual({
      totalCollected: 0,
      totalReversed: 0,
      netCollected: 0,
      chargeCount: 0,
    });
  });

  it('handles a ledger with credits only (nothing reversed)', async () => {
    const { service } = buildService(
      jest.fn().mockResolvedValue([
        {
          _id: WalletTransactionType.SERVICE_FEE_CREDIT,
          total: 4_000,
          count: 3,
        },
      ]),
    );

    await expect(service.getServiceChargeTotals()).resolves.toEqual({
      totalCollected: 4_000,
      totalReversed: 0,
      netCollected: 4_000,
      chargeCount: 3,
    });
  });
});
