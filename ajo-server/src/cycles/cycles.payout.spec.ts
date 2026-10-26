import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CyclesService } from './cycles.service';
import { ContributionStatus } from '../common/enums/cycle.enum';
import { TransferStatus } from '../common/enums/wallet.enum';
import { PAYSTACK_NOT_CONFIGURED_MESSAGE } from '../payments/paystack.service';

/**
 * Focused unit tests for `CyclesService.initiatePayout` — the admin action that
 * empties the group wallet into the cycle recipient's bank account.
 *
 * The regression these lock down: the payout amount used to be computed from
 * the live group settings (`contributionAmount × totalSlots`). If the group's
 * amount changed (or the roster shrank) after the cycle started, that asked the
 * group wallet for money the members never actually paid and every payout died
 * with "Insufficient group wallet balance". The amount must come from what the
 * cycle actually collected, and a retry after a Paystack failure must reuse the
 * existing Payout document (unique index on `cycle`).
 */

const GROUP_ID = new Types.ObjectId();
const CYCLE_ID = new Types.ObjectId();
const MEMBER_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId();
const ADMIN_ID = new Types.ObjectId();
const PAYOUT_ID = new Types.ObjectId();
const GROUP_WALLET_ID = new Types.ObjectId();

const PER_MEMBER = 5000;
const GROSS = PER_MEMBER * 3;
// Mirrors the platform default (2.5%) so the spec exercises the real maths.
const PAYOUT_FEE_PERCENT = 2.5;
const PAYOUT_FEE = Math.round((GROSS * PAYOUT_FEE_PERCENT) / 100);
const NET_AMOUNT = GROSS - PAYOUT_FEE;

function makeGroup() {
  return {
    _id: GROUP_ID,
    name: 'Family Savings',
    // Live settings deliberately larger than what the cycle collected.
    contributionAmount: PER_MEMBER,
    totalSlots: 10,
    serviceFee: 200,
    currentCycleNumber: 1,
  };
}

function makeCycle(overrides: Record<string, unknown> = {}) {
  return {
    _id: CYCLE_ID,
    group: GROUP_ID,
    status: 'open',
    cycleNumber: 1,
    recipientMember: MEMBER_ID,
    ...overrides,
  };
}

function makePayout(overrides: Record<string, unknown> = {}) {
  return {
    _id: PAYOUT_ID,
    group: GROUP_ID,
    cycle: CYCLE_ID,
    amount: 0,
    fee: 0,
    netAmount: 0,
    status: TransferStatus.FAILED,
    paystackReference: 'payout_old',
    paystackTransferCode: 'TRF_old',
    failureReason: 'previous attempt failed',
    completedAt: new Date(),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function paid(amount = PER_MEMBER) {
  return { status: ContributionStatus.PAID, amount };
}

function buildService(
  overrides: {
    contributions?: Array<{ status: ContributionStatus; amount: number }>;
    walletBalance?: number;
    cycle?: ReturnType<typeof makeCycle>;
    existingPayout?: ReturnType<typeof makePayout> | null;
    transfer?: { transferCode: string; status: string } | Error;
    recipientBankAccount?: Record<string, unknown> | null;
    paystackNotConfigured?: boolean;
    testMode?: boolean;
    otpError?: Error;
    payoutFeePercent?: number;
  } = {},
) {
  const contributions = overrides.contributions ?? [paid(), paid(), paid()];
  const cycle = overrides.cycle ?? makeCycle();
  const existingPayout =
    overrides.existingPayout === undefined ? null : overrides.existingPayout;
  const feePercent = overrides.payoutFeePercent ?? PAYOUT_FEE_PERCENT;

  const session = {
    withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn(),
  };

  const cycleModel = { findOne: jest.fn().mockResolvedValue(cycle) };

  const contributionModel = {
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(contributions),
      }),
    }),
  };

  const groupMemberModel = {
    findById: jest.fn().mockResolvedValue({ _id: MEMBER_ID, user: USER_ID }),
    findOne: jest.fn().mockResolvedValue({ user: ADMIN_ID }),
  };

  const groupWalletDoc = {
    _id: GROUP_WALLET_ID,
    balance: overrides.walletBalance ?? 100_000,
    save: jest.fn().mockResolvedValue(undefined),
  };

  const groupWalletModel = {
    findOne: jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(groupWalletDoc),
    }),
    create: jest.fn(),
  };

  const payoutDoc = makePayout({ amount: 0 });

  const payoutModel = {
    findOne: jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(existingPayout),
    }),
    create: jest.fn(([doc]: Array<Record<string, unknown>>) => {
      // Mirror Mongoose: the created document carries the values we passed in.
      Object.assign(payoutDoc, doc);
      return [payoutDoc];
    }),
    findById: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({ _id: PAYOUT_ID }),
    }),
  };

  const groupWalletTxModel = { create: jest.fn().mockResolvedValue([]) };

  const connection = { startSession: jest.fn().mockResolvedValue(session) };

  const groupAccess = {
    getGroupOrThrow: jest.fn().mockResolvedValue(makeGroup()),
    assertGroupAdmin: jest.fn().mockResolvedValue({ isGroupAdmin: true }),
  };

  const usersService = {
    findPlatformAdmin: jest.fn().mockResolvedValue({ _id: ADMIN_ID }),
    findById: jest.fn().mockResolvedValue({
      _id: USER_ID,
      name: 'Ada',
      phone: '+234800',
      bankAccount:
        overrides.recipientBankAccount === undefined
          ? {
              bankName: 'GTBank',
              accountNumber: '0123456789',
              paystackRecipientCode: 'RCP_test',
            }
          : overrides.recipientBankAccount,
    }),
  };

  const transferResult = overrides.transfer ?? {
    transferCode: 'TRF_new',
    status: 'success',
  };

  const paystack = {
    assertConfigured: overrides.paystackNotConfigured
      ? jest.fn(() => {
          throw new ServiceUnavailableException(
            PAYSTACK_NOT_CONFIGURED_MESSAGE,
          );
        })
      : jest.fn(),
    initiateTransfer:
      transferResult instanceof Error
        ? jest.fn().mockRejectedValue(transferResult)
        : jest.fn().mockResolvedValue(transferResult),
    isTestMode: jest.fn().mockReturnValue(overrides.testMode ?? false),
    resolveOtp: overrides.otpError
      ? jest.fn().mockRejectedValue(overrides.otpError)
      : jest.fn().mockResolvedValue({ status: 'success' }),
    testTransferOtp: jest.fn().mockReturnValue('123456'),
  };

  const notificationsService = { send: jest.fn().mockResolvedValue(undefined) };

  const walletService = {
    creditServiceFee: jest.fn().mockResolvedValue(undefined),
    reverseServiceFeeCredit: jest.fn().mockResolvedValue(undefined),
  };

  const platformSettings = {
    calculatePayoutFee: jest
      .fn()
      .mockImplementation((amount: number) =>
        Promise.resolve(Math.round((amount * feePercent) / 100)),
      ),
    calculateEscrowTransferFee: jest.fn().mockResolvedValue(0),
  };

  const service = new CyclesService(
    cycleModel as never,
    contributionModel as never,
    groupMemberModel as never,
    groupWalletModel as never,
    groupWalletTxModel as never,
    payoutModel as never,
    connection as never,
    groupAccess as never,
    walletService as never,
    paystack as never,
    usersService as never,
    {} as never,
    notificationsService as never,
    platformSettings as never,
  );

  // The success path fans out into next-cycle creation; that is covered by the
  // rollover tests. Here we only assert that it was reached.
  const finalize = jest
    .spyOn(service, 'finalizeSuccessfulPayout')
    .mockResolvedValue(undefined);

  return {
    service,
    finalize,
    paystack,
    payoutModel,
    payoutDoc,
    groupWalletDoc,
    groupWalletTxModel,
    notificationsService,
    groupAccess,
    platformSettings,
    walletService,
  };
}

describe('CyclesService.initiatePayout', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fails fast, with no money moved, when Paystack is not configured', async () => {
    const { service, payoutModel, groupWalletDoc, groupAccess } = buildService({
      paystackNotConfigured: true,
    });
    const balanceBefore = groupWalletDoc.balance;

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/PAYSTACK_SECRET_KEY is missing or invalid/);

    // Nothing is created, debited, or even looked up: the old behaviour left a
    // FAILED payout plus a debit/refund pair behind on every tap.
    expect(payoutModel.create).not.toHaveBeenCalled();
    expect(groupWalletDoc.balance).toBe(balanceBefore);
    expect(groupWalletDoc.save).not.toHaveBeenCalled();
    expect(groupAccess.getGroupOrThrow).not.toHaveBeenCalled();
  });

  it('refunds and reports when the test-mode transfer OTP is rejected', async () => {
    const { service, payoutDoc, groupWalletDoc, finalize } = buildService({
      transfer: { transferCode: 'TRF_otp', status: 'otp' },
      testMode: true,
      otpError: new BadRequestException('Paystack error: Invalid OTP'),
    });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/Payout could not be sent: Paystack error: Invalid OTP/);

    // The transfer never completed, so the debit must be reversed.
    expect(payoutDoc.status).toBe(TransferStatus.FAILED);
    expect(payoutDoc.paystackTransferCode).toBe('TRF_otp');
    expect(groupWalletDoc.balance).toBe(100_000);
    expect(finalize).not.toHaveBeenCalled();
  });

  it('keeps the payout alive when Paystack accepted it but finalizing failed', async () => {
    const { service, payoutDoc, groupWalletDoc, finalize } = buildService();

    // Paystack sends the money, then the local rollover blows up.
    finalize.mockRejectedValueOnce(new Error('mongo blip'));

    const result = await service.initiatePayout(
      ADMIN_ID.toString(),
      GROUP_ID.toString(),
      CYCLE_ID.toString(),
    );

    // The transfer is out of the building — never mark it FAILED/refund it,
    // or the recipient gets paid twice.
    expect(result).toEqual({ _id: PAYOUT_ID });
    expect(payoutDoc.status).toBe(TransferStatus.PENDING);
    expect(groupWalletDoc.balance).toBe(100_000 - PER_MEMBER * 3);
    expect(payoutDoc.paystackTransferCode).toBe('TRF_new');
  });

  it('pays out what the cycle collected, not the live group settings', async () => {
    const { service, paystack, payoutModel, payoutDoc, finalize } =
      buildService();

    await service.initiatePayout(
      ADMIN_ID.toString(),
      GROUP_ID.toString(),
      CYCLE_ID.toString(),
    );

    // Paystack receives the net amount; the platform fee stays behind.
    expect(paystack.initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amountNaira: NET_AMOUNT,
        recipientCode: 'RCP_test',
      }),
    );
    expect(payoutModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          amount: GROSS,
          fee: PAYOUT_FEE,
          netAmount: NET_AMOUNT,
          status: TransferStatus.PENDING,
        }),
      ],
      expect.anything(),
    );
    expect(payoutDoc.paystackTransferCode).toBe('TRF_new');
    expect(finalize).toHaveBeenCalledWith(
      payoutDoc,
      expect.anything(),
      expect.anything(),
    );
  });

  it('debits the group wallet for the collected amount only', async () => {
    const { service, groupWalletDoc, groupWalletTxModel } = buildService();

    await service.initiatePayout(
      ADMIN_ID.toString(),
      GROUP_ID.toString(),
      CYCLE_ID.toString(),
    );

    expect(groupWalletDoc.balance).toBe(100_000 - PER_MEMBER * 3);
    expect(groupWalletTxModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          amount: PER_MEMBER * 3,
          balanceBefore: 100_000,
          balanceAfter: 100_000 - PER_MEMBER * 3,
        }),
      ],
      expect.anything(),
    );
  });

  it('blocks the payout while a member has not paid', async () => {
    const { service, paystack } = buildService({
      contributions: [
        paid(),
        paid(),
        { status: ContributionStatus.PENDING, amount: PER_MEMBER },
      ],
    });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/1 member\(s\) have not paid/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('blocks the payout while a claimed transfer awaits confirmation', async () => {
    const { service, paystack } = buildService({
      contributions: [
        paid(),
        {
          status: ContributionStatus.AWAITING_CONFIRMATION,
          amount: PER_MEMBER,
        },
      ],
    });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/awaiting your confirmation/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('refuses to pay out a cycle with no contributions at all', async () => {
    const { service, paystack } = buildService({ contributions: [] });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/no contributions to pay out/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('requires the recipient to have a payout bank account', async () => {
    const { service, paystack } = buildService({ recipientBankAccount: null });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/has not set up a payout bank account/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('refuses when the group wallet cannot cover the collected amount', async () => {
    const { service, paystack } = buildService({ walletBalance: PER_MEMBER });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/Insufficient group wallet balance/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('refuses a cycle that is already paid out', async () => {
    const { service, paystack } = buildService({
      cycle: makeCycle({ status: 'completed' }),
    });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/already been paid out/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('reuses the failed payout document so a retry is not a duplicate key', async () => {
    const existingPayout = makePayout();
    const { service, payoutModel, finalize } = buildService({ existingPayout });

    await service.initiatePayout(
      ADMIN_ID.toString(),
      GROUP_ID.toString(),
      CYCLE_ID.toString(),
    );

    expect(payoutModel.create).not.toHaveBeenCalled();
    expect(existingPayout.save).toHaveBeenCalled();
    expect(existingPayout.status).toBe(TransferStatus.PENDING);
    expect(existingPayout.amount).toBe(GROSS);
    expect(existingPayout.fee).toBe(PAYOUT_FEE);
    expect(existingPayout.netAmount).toBe(NET_AMOUNT);
    expect(existingPayout.paystackTransferCode).toBe('TRF_new');
    expect(existingPayout.failureReason).toBeUndefined();
    expect(finalize).toHaveBeenCalled();
  });

  it('refuses a retry while a payout is still pending', async () => {
    const { service, paystack } = buildService({
      existingPayout: makePayout({ status: TransferStatus.PENDING }),
    });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/already in progress/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('sends the gross amount when the platform payout fee is 0%', async () => {
    const { service, paystack, payoutDoc } = buildService({
      payoutFeePercent: 0,
    });

    await service.initiatePayout(
      ADMIN_ID.toString(),
      GROUP_ID.toString(),
      CYCLE_ID.toString(),
    );

    expect(paystack.initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amountNaira: GROSS }),
    );
    expect(payoutDoc.fee).toBe(0);
    expect(payoutDoc.netAmount).toBe(GROSS);
  });

  it('refuses a payout that the platform fee would wipe out', async () => {
    const { service, paystack, finalize } = buildService({
      payoutFeePercent: 100,
    });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/doesn't cover/);

    expect(paystack.initiateTransfer).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });

  it('marks the payout FAILED, refunds the wallet and reports the Paystack error', async () => {
    const { service, payoutDoc, groupWalletDoc, notificationsService } =
      buildService({
        transfer: new BadRequestException(
          'Transfer limit exceeded for this account',
        ),
      });

    await expect(
      service.initiatePayout(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CYCLE_ID.toString(),
      ),
    ).rejects.toThrow(/Payout could not be sent: Transfer limit exceeded/);

    expect(payoutDoc.status).toBe(TransferStatus.FAILED);
    expect(payoutDoc.failureReason).toBe(
      'Transfer limit exceeded for this account',
    );
    // Debited then refunded — the group is whole again and can retry.
    expect(groupWalletDoc.balance).toBe(100_000);
    expect(notificationsService.send).toHaveBeenCalled();
  });
});

describe('CyclesService.handleReversedPayout', () => {
  it('refunds the group wallet and claws the platform fee back', async () => {
    const payout = makePayout({
      status: TransferStatus.SUCCESS,
      amount: GROSS,
      fee: PAYOUT_FEE,
      netAmount: NET_AMOUNT,
    });
    const { service, groupWalletDoc, walletService } = buildService({
      existingPayout: payout,
    });

    await service.handleReversedPayout(payout as never, makeGroup() as never);

    expect(payout.status).toBe(TransferStatus.REVERSED);
    // The group wallet is made whole for the amount Paystack sent back.
    expect(groupWalletDoc.balance).toBe(100_000 + GROSS);
    // The fee was credited when the payout succeeded, so it is clawed back.
    expect(walletService.reverseServiceFeeCredit).toHaveBeenCalledWith(
      ADMIN_ID.toString(),
      PAYOUT_FEE,
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        reference: `payout_fee_reversal_${PAYOUT_ID.toString()}`,
      }),
    );
  });

  it('does not claw back a fee that was never credited', async () => {
    // A PENDING payout was reversed before we recognised the fee.
    const payout = makePayout({
      status: TransferStatus.PENDING,
      amount: GROSS,
      fee: PAYOUT_FEE,
      netAmount: NET_AMOUNT,
    });
    const { service, walletService } = buildService({ existingPayout: payout });

    await service.handleReversedPayout(payout as never, makeGroup() as never);

    expect(payout.status).toBe(TransferStatus.REVERSED);
    expect(walletService.reverseServiceFeeCredit).not.toHaveBeenCalled();
  });
});
