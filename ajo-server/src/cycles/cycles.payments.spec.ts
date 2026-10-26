import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CyclesService } from './cycles.service';
import {
  ContributionPaymentMethod,
  ContributionStatus,
} from '../common/enums/cycle.enum';

/**
 * Focused unit tests for the member-initiated contribution flows:
 *   - payContributionFromWallet
 *   - notifyBankTransferPayment
 *   - confirmContributionPaid
 *   - rejectContributionPayment
 *
 * The reading path (`getCurrentCycle`) is stubbed because it only shapes the
 * response; these tests assert the money movements and state transitions.
 */

const GROUP_ID = new Types.ObjectId();
const CYCLE_ID = new Types.ObjectId();
const MEMBER_ID = new Types.ObjectId();
const USER_ID = new Types.ObjectId();
const ADMIN_ID = new Types.ObjectId();
const CONTRIBUTION_ID = new Types.ObjectId();
const GROUP_WALLET_ID = new Types.ObjectId();

const SERVICE_FEE = 200;
const AMOUNT = 5000;

const cycleResponse = { cycle: { _id: CYCLE_ID }, contributions: [] } as never;

function makeGroup() {
  return {
    _id: GROUP_ID,
    name: 'Family Savings',
    joinCode: 'ABCD1234',
    contributionAmount: AMOUNT,
    serviceFee: SERVICE_FEE,
    currentCycleNumber: 1,
    currentRound: 1,
    escrowAccount: { accountNumber: '0123456789' },
  };
}

function makeContribution(overrides: Record<string, unknown> = {}) {
  return {
    _id: CONTRIBUTION_ID,
    group: GROUP_ID,
    cycle: CYCLE_ID,
    member: MEMBER_ID,
    user: USER_ID,
    amount: AMOUNT,
    serviceFee: 0,
    status: ContributionStatus.PENDING,
    paymentReference: 'AJO-ABCD1234-2',
    // Optional fields the service sets/clears while processing a transfer.
    paymentMethod: undefined as ContributionPaymentMethod | undefined,
    claimedTransferReference: undefined as string | undefined,
    lastRejectionReason: undefined as string | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function buildService(
  overrides: {
    contribution?: ReturnType<typeof makeContribution>;
    deposit?: Record<string, unknown> | null;
    walletBalance?: number;
    debited?: boolean;
    payoutFee?: number;
  } = {},
) {
  const contribution = overrides.contribution ?? makeContribution();

  const session = {
    withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn(),
  };

  const cycleModel = {
    findById: jest.fn().mockResolvedValue({
      _id: CYCLE_ID,
      status: 'open',
      cycleNumber: 1,
    }),
  };

  const contributionModel = {
    findOne: jest.fn().mockResolvedValue(contribution),
  };

  const groupMemberModel = {
    findOne: jest.fn().mockResolvedValue({ user: ADMIN_ID }),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    }),
  };

  const groupWalletDoc = {
    _id: GROUP_WALLET_ID,
    balance: 0,
    save: jest.fn().mockResolvedValue(undefined),
  };

  const groupWalletModel = {
    findOne: jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(groupWalletDoc),
    }),
  };

  const groupWalletTxModel = { create: jest.fn().mockResolvedValue([]) };

  const connection = { startSession: jest.fn().mockResolvedValue(session) };

  const groupAccess = {
    getGroupOrThrow: jest.fn().mockResolvedValue(makeGroup()),
    assertAcceptedMember: jest.fn().mockResolvedValue({ isGroupAdmin: false }),
    assertGroupAdmin: jest.fn().mockResolvedValue({ isGroupAdmin: true }),
  };

  const walletService = {
    getOrCreateWallet: jest
      .fn()
      .mockResolvedValue({ balance: overrides.walletBalance ?? 100_000 }),
    debitForContribution: jest
      .fn()
      .mockResolvedValue(overrides.debited ?? true),
    debitServiceFee: jest.fn().mockResolvedValue(undefined),
    creditServiceFee: jest.fn().mockResolvedValue(undefined),
    refundServiceFee: jest.fn().mockResolvedValue(undefined),
  };

  const usersService = {
    findPlatformAdmin: jest.fn().mockResolvedValue({ _id: ADMIN_ID }),
    findById: jest.fn().mockResolvedValue({ name: 'Ada', phone: '+234800' }),
  };

  const escrowService = {
    findUnallocatedDepositForContribution: jest
      .fn()
      .mockResolvedValue(overrides.deposit ?? null),
    allocateDeposit: jest.fn().mockResolvedValue(undefined),
    releaseDepositForContribution: jest.fn().mockResolvedValue(undefined),
    getStoredEscrowAccount: jest.fn().mockReturnValue(null),
  };

  const notificationsService = { send: jest.fn().mockResolvedValue(undefined) };

  // The platform rate is owned by PlatformSettingsService; the spec stubs it
  // so the assertions can talk in naira instead of percentages.
  const platformSettings = {
    calculateEscrowTransferFee: jest.fn().mockResolvedValue(SERVICE_FEE),
    calculatePayoutFee: jest.fn().mockResolvedValue(overrides.payoutFee ?? 0),
  };

  const service = new CyclesService(
    cycleModel as never,
    contributionModel as never,
    groupMemberModel as never,
    groupWalletModel as never,
    groupWalletTxModel as never,
    {} as never,
    connection as never,
    groupAccess as never,
    walletService as never,
    {} as never,
    usersService as never,
    escrowService as never,
    notificationsService as never,
    platformSettings as never,
  );

  const withPrivate = service as unknown as {
    getCurrentCycle: () => Promise<unknown>;
  };
  jest.spyOn(withPrivate, 'getCurrentCycle').mockResolvedValue(cycleResponse);

  return {
    service,
    contribution,
    session,
    groupWalletModel,
    groupWalletTxModel,
    walletService,
    escrowService,
    notificationsService,
    groupAccess,
    platformSettings,
  };
}

describe('CyclesService — member-initiated payments', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('payContributionFromWallet', () => {
    it('debits the wallet plus fee, credits the group wallet and marks PAID', async () => {
      const {
        service,
        contribution,
        walletService,
        groupWalletTxModel,
        platformSettings,
      } = buildService();

      await service.payContributionFromWallet(
        USER_ID.toString(),
        GROUP_ID.toString(),
        CONTRIBUTION_ID.toString(),
      );

      // The rate comes from the platform settings, not the group document.
      expect(platformSettings.calculateEscrowTransferFee).toHaveBeenCalledWith(
        AMOUNT,
      );
      expect(walletService.debitForContribution).toHaveBeenCalledWith(
        USER_ID,
        AMOUNT,
        expect.objectContaining({ group: GROUP_ID, cycle: CYCLE_ID }),
        expect.anything(),
        SERVICE_FEE,
      );
      expect(walletService.creditServiceFee).toHaveBeenCalledWith(
        ADMIN_ID.toString(),
        SERVICE_FEE,
        expect.objectContaining({ contribution: CONTRIBUTION_ID }),
        expect.anything(),
      );
      expect(contribution.status).toBe(ContributionStatus.PAID);
      expect(contribution.paymentMethod).toBe(ContributionPaymentMethod.WALLET);
      expect(contribution.serviceFee).toBe(SERVICE_FEE);
      // Group wallet credited via a CONTRIBUTION_CREDIT ledger entry.
      expect(groupWalletTxModel.create).toHaveBeenCalledTimes(1);
    });

    it('refuses to pay when the wallet cannot cover amount + fee', async () => {
      const { service, walletService } = buildService({
        walletBalance: AMOUNT,
      });

      await expect(
        service.payContributionFromWallet(
          USER_ID.toString(),
          GROUP_ID.toString(),
          CONTRIBUTION_ID.toString(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(walletService.debitForContribution).not.toHaveBeenCalled();
    });

    it("rejects someone else's contribution", async () => {
      const { service } = buildService({
        contribution: makeContribution({ user: new Types.ObjectId() }),
      });

      await expect(
        service.payContributionFromWallet(
          USER_ID.toString(),
          GROUP_ID.toString(),
          CONTRIBUTION_ID.toString(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('notifyBankTransferPayment', () => {
    it('charges the fee, awaits admin confirmation and notifies the admin', async () => {
      const {
        service,
        contribution,
        walletService,
        notificationsService,
        platformSettings,
      } = buildService();

      await service.notifyBankTransferPayment(
        USER_ID.toString(),
        GROUP_ID.toString(),
        CONTRIBUTION_ID.toString(),
        '  TRF-991  ',
      );

      expect(platformSettings.calculateEscrowTransferFee).toHaveBeenCalledWith(
        AMOUNT,
      );
      expect(walletService.debitServiceFee).toHaveBeenCalledWith(
        USER_ID,
        SERVICE_FEE,
        expect.objectContaining({ contribution: CONTRIBUTION_ID }),
        expect.anything(),
      );
      expect(contribution.status).toBe(
        ContributionStatus.AWAITING_CONFIRMATION,
      );
      expect(contribution.paymentMethod).toBe(
        ContributionPaymentMethod.BANK_TRANSFER,
      );
      expect(contribution.claimedTransferReference).toBe('TRF-991');
      expect(notificationsService.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmContributionPaid', () => {
    it('allocates the matching escrow deposit instead of crediting twice', async () => {
      const deposit = { _id: new Types.ObjectId() };
      const contribution = makeContribution({
        status: ContributionStatus.AWAITING_CONFIRMATION,
        serviceFee: SERVICE_FEE,
      });

      const {
        service,
        walletService,
        escrowService,
        groupWalletModel,
        groupWalletTxModel,
      } = buildService({ contribution, deposit });

      await service.confirmContributionPaid(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CONTRIBUTION_ID.toString(),
      );

      expect(
        escrowService.findUnallocatedDepositForContribution,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ contributionId: CONTRIBUTION_ID }),
      );
      expect(escrowService.allocateDeposit).toHaveBeenCalledWith(
        deposit,
        expect.objectContaining({
          cycle: CYCLE_ID,
          contribution: CONTRIBUTION_ID,
          adminUserId: ADMIN_ID.toString(),
        }),
        expect.anything(),
      );
      // The webhook already credited the group wallet on settle.
      expect(groupWalletModel.findOne).not.toHaveBeenCalled();
      expect(groupWalletTxModel.create).not.toHaveBeenCalled();
      expect(walletService.creditServiceFee).toHaveBeenCalledTimes(1);
      expect(contribution.status).toBe(ContributionStatus.PAID);
      const confirmedBy = (contribution as { confirmedBy?: Types.ObjectId })
        .confirmedBy;
      expect(confirmedBy?.toString()).toBe(ADMIN_ID.toString());
    });

    it('credits the group wallet when no escrow deposit is found', async () => {
      const contribution = makeContribution({
        status: ContributionStatus.AWAITING_CONFIRMATION,
        serviceFee: SERVICE_FEE,
      });

      const { service, groupWalletTxModel } = buildService({
        contribution,
        deposit: null,
      });

      await service.confirmContributionPaid(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CONTRIBUTION_ID.toString(),
      );

      expect(groupWalletTxModel.create).toHaveBeenCalledTimes(1);
      expect(contribution.status).toBe(ContributionStatus.PAID);
    });

    it('rejects confirming a contribution that was never claimed', async () => {
      const { service } = buildService();

      await expect(
        service.confirmContributionPaid(
          ADMIN_ID.toString(),
          GROUP_ID.toString(),
          CONTRIBUTION_ID.toString(),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('rejectContributionPayment', () => {
    it('refunds the fee, releases the deposit and returns to PENDING', async () => {
      const contribution = makeContribution({
        status: ContributionStatus.AWAITING_CONFIRMATION,
        serviceFee: SERVICE_FEE,
        paymentMethod: ContributionPaymentMethod.BANK_TRANSFER,
      });

      const { service, walletService, escrowService } = buildService({
        contribution,
      });

      await service.rejectContributionPayment(
        ADMIN_ID.toString(),
        GROUP_ID.toString(),
        CONTRIBUTION_ID.toString(),
        'Transfer never arrived',
      );

      expect(escrowService.releaseDepositForContribution).toHaveBeenCalledWith(
        GROUP_ID,
        CONTRIBUTION_ID,
        expect.anything(),
      );
      expect(walletService.refundServiceFee).toHaveBeenCalledWith(
        USER_ID,
        SERVICE_FEE,
        expect.objectContaining({ contribution: CONTRIBUTION_ID }),
        expect.anything(),
      );
      expect(contribution.status).toBe(ContributionStatus.PENDING);
      expect(contribution.paymentMethod).toBeUndefined();
      expect(contribution.serviceFee).toBe(0);
      expect(contribution.lastRejectionReason).toBe('Transfer never arrived');
    });
  });
});
