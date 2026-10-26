import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { SavingsService } from './savings.service';
import {
  SavingPlanStatus,
  SavingDurationUnit,
} from '../common/enums/saving.enum';
import { ContributionFrequency } from '../common/enums/group.enum';

/**
 * Focused unit tests for the member-initiated savings payment flow
 * (`payInterval`), which replaced the old wallet auto-debit scheduler:
 *   - a payment moves money wallet -> plan and advances the schedule,
 *   - the last payment completes the cycle,
 *   - insufficient wallet balance changes nothing,
 *   - non-active plans / fully-paid cycles are rejected,
 *   - a double tap pays only once (idempotent via the unique reference).
 */

const USER_ID = new Types.ObjectId().toString();
const PLAN_ID = new Types.ObjectId();
const AMOUNT = 5000;

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    _id: PLAN_ID,
    user: new Types.ObjectId(USER_ID),
    name: 'House rent',
    amount: AMOUNT,
    frequency: ContributionFrequency.MONTHLY,
    intervalCount: 3,
    cycleNumber: 1,
    collectedCount: 0,
    savingsBalance: 0,
    lifetimeSaved: 0,
    status: SavingPlanStatus.ACTIVE,
    nextDueAt: new Date(),
    startAt: new Date(),
    endAt: undefined as Date | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildService(
  overrides: {
    plan?: ReturnType<typeof makePlan>;
    debited?: boolean;
    savingTxCreate?: jest.Mock;
  } = {},
) {
  const plan = overrides.plan ?? makePlan();

  const session = {
    withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn(),
  };

  const savingPlanModel = {
    findOne: jest.fn().mockResolvedValue(plan),
    create: jest.fn(),
  };

  const savingTxModel = {
    create: overrides.savingTxCreate ?? jest.fn().mockResolvedValue([{}]),
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({
        skip: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    }),
  };

  const connection = { startSession: jest.fn().mockResolvedValue(session) };
  const walletService = {
    debitForSavings: jest.fn().mockResolvedValue(overrides.debited ?? true),
  };
  const paystack = {};
  const usersService = { findById: jest.fn().mockResolvedValue(null) };
  const notificationsService = { send: jest.fn().mockResolvedValue(undefined) };

  const service = new SavingsService(
    savingPlanModel as never,
    savingTxModel as never,
    connection as never,
    walletService as never,
    paystack as never,
    usersService as never,
    notificationsService as never,
  );

  return {
    service,
    plan,
    session,
    savingPlanModel,
    savingTxModel,
    walletService,
    notificationsService,
  };
}

describe('SavingsService.payInterval', () => {
  it('pays one interval from the wallet and advances the plan', async () => {
    const { service, plan, walletService, savingTxModel } = buildService();
    const dueBefore = new Date(plan.nextDueAt.getTime());

    const result = await service.payInterval(USER_ID, PLAN_ID.toString());

    expect(walletService.debitForSavings).toHaveBeenCalledTimes(1);
    expect(walletService.debitForSavings).toHaveBeenCalledWith(
      plan.user,
      AMOUNT,
      { savingPlan: PLAN_ID },
      `saving_${PLAN_ID.toString()}_1_0`,
      expect.anything(),
    );
    expect(savingTxModel.create).toHaveBeenCalledTimes(1);
    expect(plan.collectedCount).toBe(1);
    expect(plan.savingsBalance).toBe(AMOUNT);
    expect(plan.lifetimeSaved).toBe(AMOUNT);
    expect(plan.status).toBe(SavingPlanStatus.ACTIVE);
    expect(plan.nextDueAt.getTime()).toBeGreaterThan(dueBefore.getTime());
    expect(result.plan).toBe(plan);
  });

  it('completes the cycle on the final payment', async () => {
    const plan = makePlan({ intervalCount: 1, collectedCount: 0 });
    const { service } = buildService({ plan });

    await service.payInterval(USER_ID, PLAN_ID.toString());

    expect(plan.status).toBe(SavingPlanStatus.COMPLETED);
    expect(plan.collectedCount).toBe(1);
    expect(plan.endAt).toBeInstanceOf(Date);
  });

  it('rejects the payment when the wallet cannot cover it', async () => {
    const { service, plan, session } = buildService({ debited: false });

    await expect(
      service.payInterval(USER_ID, PLAN_ID.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(plan.collectedCount).toBe(0);
    expect(plan.savingsBalance).toBe(0);
    expect(plan.save).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  it('rejects a plan that is no longer active', async () => {
    const plan = makePlan({ status: SavingPlanStatus.COMPLETED });
    const { service, walletService } = buildService({ plan });

    await expect(
      service.payInterval(USER_ID, PLAN_ID.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(walletService.debitForSavings).not.toHaveBeenCalled();
  });

  it('rejects a cycle whose intervals are all paid', async () => {
    const plan = makePlan({ collectedCount: 3 });
    const { service, walletService } = buildService({ plan });

    await expect(
      service.payInterval(USER_ID, PLAN_ID.toString()),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(walletService.debitForSavings).not.toHaveBeenCalled();
  });

  it('charges once when the same interval is paid twice (double tap)', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), {
      code: 11000,
    });
    const { service, plan, walletService } = buildService({
      savingTxCreate: jest.fn().mockRejectedValue(duplicateKeyError),
    });

    const result = await service.payInterval(USER_ID, PLAN_ID.toString());

    expect(walletService.debitForSavings).not.toHaveBeenCalled();
    expect(plan.collectedCount).toBe(0);
    expect(result.plan).toBe(plan);
  });
});

describe('SavingsService.getPlan activity pagination', () => {
  /** Wires `find()` so the skip/limit of the activity query can be asserted. */
  function spyActivityQuery(
    savingTxModel: ReturnType<typeof buildService>['savingTxModel'],
  ) {
    const lean = jest.fn().mockResolvedValue([]);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    savingTxModel.find.mockReturnValue({ sort });
    return { skip, limit };
  }

  it('pages activity 10 rows at a time and reports the total', async () => {
    const { service, savingTxModel } = buildService();
    savingTxModel.countDocuments.mockResolvedValue(23);
    const { skip, limit } = spyActivityQuery(savingTxModel);

    const first = await service.getPlan(USER_ID, PLAN_ID.toString());

    expect(first).toMatchObject({ page: 1, limit: 10, total: 23 });
    expect(skip).toHaveBeenLastCalledWith(0);
    expect(limit).toHaveBeenLastCalledWith(10);

    const second = await service.getPlan(USER_ID, PLAN_ID.toString(), {
      page: 2,
    });

    expect(second).toMatchObject({ page: 2, limit: 10, total: 23 });
    expect(skip).toHaveBeenLastCalledWith(10);
  });

  it('clamps an out-of-range page to the last page', async () => {
    const { service, savingTxModel } = buildService();
    savingTxModel.countDocuments.mockResolvedValue(23);
    const { skip } = spyActivityQuery(savingTxModel);

    const result = await service.getPlan(USER_ID, PLAN_ID.toString(), {
      page: 99,
    });

    expect(result).toMatchObject({ page: 3, limit: 10, total: 23 });
    expect(skip).toHaveBeenLastCalledWith(20);
  });

  it('caps the page size and falls back on invalid input', async () => {
    const { service, savingTxModel } = buildService();
    savingTxModel.countDocuments.mockResolvedValue(200);
    const { limit, skip } = spyActivityQuery(savingTxModel);

    const capped = await service.getPlan(USER_ID, PLAN_ID.toString(), {
      limit: 500,
    });

    expect(capped.limit).toBe(50);
    expect(limit).toHaveBeenLastCalledWith(50);

    const fallback = await service.getPlan(USER_ID, PLAN_ID.toString(), {
      page: Number.NaN,
      limit: Number.NaN,
    });

    expect(fallback).toMatchObject({ page: 1, limit: 10 });
    expect(skip).toHaveBeenLastCalledWith(0);
  });

  it('returns page 1 for a plan with no activity yet', async () => {
    const { service, savingTxModel } = buildService();
    spyActivityQuery(savingTxModel);

    const result = await service.getPlan(USER_ID, PLAN_ID.toString(), {
      page: 4,
    });

    expect(result).toMatchObject({ page: 1, limit: 10, total: 0 });
    expect(result.transactions).toEqual([]);
  });
});

/**
 * Plans created before `intervalCount` existed have no snapshotted count.
 * Without it the app hides the "Pay" action (0 of 0 intervals) and the cycle
 * can never complete, so the service derives the schedule from
 * (frequency, duration) when it loads such a plan.
 */
describe('SavingsService — legacy plans without an intervalCount', () => {
  it('derives the interval count on load and persists it', async () => {
    const plan = makePlan({
      intervalCount: undefined,
      durationUnit: SavingDurationUnit.MONTHS,
      durationValue: 3,
    });
    const { service } = buildService({ plan });

    await service.payInterval(USER_ID, PLAN_ID.toString());

    expect(plan.intervalCount).toBe(3);
    expect(plan.save).toHaveBeenCalled();
    // Payment went through with the derived schedule.
    expect(plan.collectedCount).toBe(1);
    expect(plan.status).toBe(SavingPlanStatus.ACTIVE);
  });

  it('shows the derived schedule in listPlans without writing', async () => {
    const plan = makePlan({
      intervalCount: undefined,
      frequency: ContributionFrequency.DAILY,
      durationUnit: SavingDurationUnit.DAYS,
      durationValue: 20,
    });
    const { service, savingPlanModel } = buildService({ plan });
    const lean = jest.fn().mockResolvedValue([plan]);
    const sort = jest.fn().mockReturnValue({ lean });
    (savingPlanModel as unknown as { find: jest.Mock }).find = jest
      .fn()
      .mockReturnValue({ sort });

    const result = (await service.listPlans(USER_ID)) as Array<{
      intervalCount: number;
    }>;

    expect(result[0].intervalCount).toBe(20);
    expect(plan.save).not.toHaveBeenCalled();
  });

  it('leaves plans that already have a count untouched', async () => {
    const plan = makePlan({ intervalCount: 6, collectedCount: 0 });
    const { service } = buildService({ plan });

    await service.getPlan(USER_ID, PLAN_ID.toString());

    expect(plan.intervalCount).toBe(6);
    expect(plan.save).not.toHaveBeenCalled();
  });
});
