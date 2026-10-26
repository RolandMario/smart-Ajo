import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { DonationsService } from './donations.service';
import {
  DonationAmountType,
  DonationEscrowTransactionType,
  DonationGroupStatus,
  DonationFrequency,
  DonationSchedule,
} from '../common/enums/donation.enum';
import { TransferStatus } from '../common/enums/wallet.enum';
import { NotificationType } from '../common/enums/notification.enum';
import { currentPeriodKey } from './utils/donation-period';

/**
 * Focused unit tests for the pool donation flow:
 *   - donating moves money wallet -> escrow and bumps both ledgers,
 *   - fixed pools reject a mismatching amount, free-will pools need one,
 *   - a short wallet changes nothing, a closed pool rejects donations,
 *   - a double tap donates once (unique reference / {group,user,period}),
 *   - joining is idempotent,
 *   - payouts reserve escrow first, use the pool override (or the admin's
 *     account), and only credit `totalPaidOut` on success,
 *   - failures/reversals put the money back exactly once.
 */

const ADMIN_ID = new Types.ObjectId().toString();
const USER_ID = new Types.ObjectId().toString();
const THIRD_ID = new Types.ObjectId().toString();
const FOURTH_ID = new Types.ObjectId().toString();
const GROUP_ID = new Types.ObjectId();
const MEMBER_ID = new Types.ObjectId();
const PAYOUT_ID = new Types.ObjectId();

type AnyMock = jest.Mock;

/** `expect.any(Date)` typed as `unknown` so object literals stay type-safe. */
const anyDate = (): unknown => expect.any(Date);

/** `expect.arrayContaining` typed as `unknown` so object literals stay type-safe. */
const anyOf = (items: unknown[]): unknown => expect.arrayContaining(items);

/**
 * A chainable Mongoose query stub: `.select().sort().skip().limit().lean()`
 * in any order, resolving to `rows`.
 */
function rowsQuery(rows: unknown[]) {
  const query = {
    select: jest.fn(),
    sort: jest.fn(),
    skip: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn().mockResolvedValue(rows),
  };
  query.select.mockReturnValue(query);
  query.sort.mockReturnValue(query);
  query.skip.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  return query;
}

function makeGroup(overrides: Record<string, unknown> = {}) {
  const plain = {
    _id: GROUP_ID,
    name: "Chidi's Wedding Fund",
    purpose: 'Help Chidi celebrate',
    amountType: DonationAmountType.FIXED,
    amount: 1000,
    schedule: DonationSchedule.INTERVAL,
    frequency: DonationFrequency.MONTHLY,
    joinCode: 'ABC23456',
    admin: new Types.ObjectId(ADMIN_ID),
    status: DonationGroupStatus.ACTIVE,
    escrowBalance: 5000,
    totalCollected: 5000,
    totalPaidOut: 0,
    memberCount: 2,
    donorCount: 1,
    payoutAccount: undefined as Record<string, unknown> | undefined,
    terminationVotes: [] as Types.ObjectId[],
    terminatedAt: undefined as Date | undefined,
    terminatedBy: undefined as Types.ObjectId | undefined,
    ...overrides,
  };

  return {
    ...plain,
    toObject: () => ({ ...plain }),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    _id: MEMBER_ID,
    group: GROUP_ID,
    user: new Types.ObjectId(USER_ID),
    totalDonated: 0,
    donationCount: 0,
    joinedAt: new Date(),
    lastDonatedAt: undefined as Date | undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makePayout(overrides: Record<string, unknown> = {}) {
  return {
    _id: PAYOUT_ID,
    group: GROUP_ID,
    initiatedBy: new Types.ObjectId(ADMIN_ID),
    amount: 1000,
    status: TransferStatus.PENDING,
    paystackReference: 'donation_payout_ref',
    bankName: 'GTBank',
    accountNumber: '0123456789',
    accountName: 'Chidi Admin',
    ...overrides,
  };
}

function buildService(
  options: {
    group?: ReturnType<typeof makeGroup>;
    member?: ReturnType<typeof makeMember> | null;
    payout?: ReturnType<typeof makePayout> | null;
    debited?: boolean;
    donationCreate?: AnyMock;
    payoutCreate?: AnyMock;
    transfer?: { status: string; transferCode: string };
    users?: Record<string, unknown> | null;
    groupReserved?: Record<string, unknown>;
    groupUpdated?: Record<string, unknown>;
    groupRefunded?: Record<string, unknown>;
    donationRows?: unknown[];
    donationTotal?: number;
    /** Membership rows returned by `DonationMember.find` (voter eligibility). */
    donationMembers?: unknown[];
    /** Donation rows returned by `Donation.find` (period payment check). */
    periodDonors?: unknown[];
    /** Legacy `status: 'terminated'` pools returned by `purgeTerminatedPools`. */
    terminatedPools?: unknown[];
    /** Platform percentages used by the stubbed PlatformSettingsService. */
    escrowTransferFeePercent?: number;
    payoutFeePercent?: number;
  } = {},
) {
  const group = options.group ?? makeGroup();
  const member = options.member === undefined ? makeMember() : options.member;
  const payout = options.payout === undefined ? makePayout() : options.payout;
  const escrowFeePercent = options.escrowTransferFeePercent ?? 1;
  const payoutFeePercent = options.payoutFeePercent ?? 2.5;

  const session = {
    withTransaction: jest.fn(async (fn: () => Promise<void>) => fn()),
    endSession: jest.fn(),
  };

  // `findById` is awaited in guards but chained (`.select().lean()`) by the
  // payout notification helpers, so it returns an awaitable that also has a
  // `select` method.
  const groupQuery = () => {
    const name = group.name;
    return Object.assign(Promise.resolve(group), {
      select: () => ({ lean: () => Promise.resolve({ name }) }),
    });
  };

  const donationGroupModel = {
    findById: jest.fn(() => groupQuery()),
    findOne: jest.fn().mockResolvedValue(group),
    create: jest.fn().mockResolvedValue([group]),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    findByIdAndUpdate: jest
      .fn()
      .mockResolvedValue(
        options.groupUpdated ?? options.groupRefunded ?? group,
      ),
    findOneAndUpdate: jest
      .fn()
      .mockResolvedValue(options.groupReserved ?? group),
    find: jest.fn<unknown, unknown[]>(() =>
      rowsQuery(options.terminatedPools ?? []),
    ),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };

  const donationMemberModel = {
    findOne: jest.fn().mockResolvedValue(member),
    findById: jest.fn().mockReturnValue({
      session: jest.fn().mockResolvedValue(member),
    }),
    find: jest.fn<unknown, unknown[]>(() =>
      rowsQuery(options.donationMembers ?? []),
    ),
    create: jest.fn().mockResolvedValue(member ?? makeMember()),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };

  const donationModel = {
    create:
      options.donationCreate ?? jest.fn().mockResolvedValue([{ _id: 'don_1' }]),
    findOne: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      }),
    }),
    find: jest.fn<unknown, unknown[]>(() =>
      rowsQuery(options.periodDonors ?? []),
    ),
    countDocuments: jest.fn().mockResolvedValue(options.donationTotal ?? 0),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };

  const donationPayoutModel = {
    create: options.payoutCreate ?? jest.fn().mockResolvedValue([payout]),
    findOne: jest.fn().mockResolvedValue(payout),
    findById: jest.fn().mockResolvedValue(payout),
    findOneAndUpdate: jest.fn().mockResolvedValue(payout),
    updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    countDocuments: jest.fn().mockResolvedValue(0),
    find: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };

  const escrowTxModel = {
    create: jest.fn().mockResolvedValue([{}]),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
  };

  const connection = { startSession: jest.fn().mockResolvedValue(session) };

  const walletService = {
    debitForDonation: jest.fn().mockResolvedValue(options.debited ?? true),
    creditServiceFee: jest.fn().mockResolvedValue(undefined),
    reverseServiceFeeCredit: jest.fn().mockResolvedValue(undefined),
  };

  const paystack = {
    initiateTransfer: jest
      .fn()
      .mockResolvedValue(
        options.transfer ?? { status: 'success', transferCode: 'TRF_1' },
      ),
    resolveOtp: jest.fn().mockResolvedValue({ status: 'success' }),
    isTestMode: jest.fn().mockReturnValue(true),
    testTransferOtp: jest.fn().mockReturnValue('123456'),
    resolveAccountNumber: jest.fn(),
    createTransferRecipient: jest.fn(),
  };

  const defaultUsers: Record<string, unknown> = {
    [USER_ID]: { _id: USER_ID, name: 'Ada', phone: '08030000000' },
    [ADMIN_ID]: { _id: ADMIN_ID, name: 'Chidi', phone: '08031111111' },
  };
  const directory = options.users === undefined ? defaultUsers : options.users;
  const usersService = {
    findById: jest.fn((id: string) =>
      Promise.resolve((directory ?? {})[id] ?? null),
    ),
    findPlatformAdmin: jest
      .fn()
      .mockResolvedValue({ _id: new Types.ObjectId(ADMIN_ID) }),
    findByIds: jest.fn().mockResolvedValue(
      [
        ...new Set(
          ((options.donationRows ?? []) as Array<{ user: Types.ObjectId }>).map(
            (row) => row.user.toString(),
          ),
        ),
      ].map((id) => ({
        _id: new Types.ObjectId(id),
        name: 'Ada',
        phone: '08030000000',
      })),
    ),
  };

  const notificationsService = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  // Percentages are owned by PlatformSettingsService; the stub applies them
  // exactly like the real service (whole naira, capped at the amount).
  const feeFor = (percent: number) => (amount: number) =>
    Math.min(Math.round((amount * percent) / 100), amount);
  const platformSettings = {
    calculateEscrowTransferFee: jest
      .fn()
      .mockImplementation((amount: number) =>
        Promise.resolve(feeFor(escrowFeePercent)(amount)),
      ),
    calculatePayoutFee: jest
      .fn()
      .mockImplementation((amount: number) =>
        Promise.resolve(feeFor(payoutFeePercent)(amount)),
      ),
    getServiceCharges: jest.fn().mockResolvedValue({
      escrowTransferFeePercent: escrowFeePercent,
      payoutFeePercent,
    }),
  };

  const service = new DonationsService(
    donationGroupModel as never,
    donationMemberModel as never,
    donationModel as never,
    donationPayoutModel as never,
    escrowTxModel as never,
    connection as never,
    walletService as never,
    paystack as never,
    usersService as never,
    notificationsService as never,
    platformSettings as never,
  );

  return {
    service,
    connection,
    group,
    member,
    payout,
    session,
    donationGroupModel,
    donationMemberModel,
    donationModel,
    donationPayoutModel,
    escrowTxModel,
    walletService,
    paystack,
    usersService,
    notificationsService,
    platformSettings,
  };
}

describe('DonationsService.donate', () => {
  const period = currentPeriodKey(
    DonationSchedule.INTERVAL,
    DonationFrequency.MONTHLY,
  );
  const reference = `don_${GROUP_ID.toString()}_${USER_ID}_${period}`;

  it('moves the amount from the wallet into escrow and records both ledgers', async () => {
    const updatedGroup = makeGroup({
      escrowBalance: 6000,
      totalCollected: 6000,
      donorCount: 2,
    });
    const member = makeMember();
    const ctx = buildService({ member, groupUpdated: updatedGroup });
    jest
      .spyOn(ctx.service, 'getGroup')
      .mockResolvedValue({ group: updatedGroup } as never);

    const result = await ctx.service.donate(USER_ID, GROUP_ID.toString(), {});

    // 1% of ₦1,000 → ₦10 platform transfer fee, charged on top of the donation.
    expect(ctx.walletService.debitForDonation).toHaveBeenCalledWith(
      new Types.ObjectId(USER_ID),
      1000,
      { donationGroup: GROUP_ID },
      reference,
      ctx.session,
      10,
    );

    expect(ctx.walletService.creditServiceFee).toHaveBeenCalledWith(
      ADMIN_ID,
      10,
      {},
      ctx.session,
      expect.objectContaining({ reference: `${reference}_fee` }),
    );

    expect(ctx.donationModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          group: GROUP_ID,
          user: new Types.ObjectId(USER_ID),
          amount: 1000,
          serviceFee: 10,
          period,
          reference,
        }),
      ],
      { session: ctx.session },
    );

    expect(member.totalDonated).toBe(1000);
    expect(member.donationCount).toBe(1);
    expect(member.lastDonatedAt).toBeInstanceOf(Date);
    expect(member.save).toHaveBeenCalledWith({ session: ctx.session });

    expect(ctx.donationGroupModel.findByIdAndUpdate).toHaveBeenCalledWith(
      GROUP_ID,
      {
        $inc: { escrowBalance: 1000, totalCollected: 1000, donorCount: 1 },
        $set: { lastDonationAt: anyDate() },
      },
      { new: true, session: ctx.session },
    );

    expect(ctx.escrowTxModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          group: GROUP_ID,
          type: DonationEscrowTransactionType.DONATION_CREDIT,
          amount: 1000,
          balanceBefore: 5000,
          balanceAfter: 6000,
          reference,
        }),
      ],
      { session: ctx.session },
    );

    // Donor receipt + admin heads-up.
    expect(ctx.notificationsService.send).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ group: updatedGroup });
  });

  it('does not credit the pool when the wallet balance is too low', async () => {
    const member = makeMember();
    const ctx = buildService({ member, debited: false });

    await expect(
      ctx.service.donate(USER_ID, GROUP_ID.toString(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.donationGroupModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(member.save).not.toHaveBeenCalled();
    expect(ctx.escrowTxModel.create).not.toHaveBeenCalled();
    expect(ctx.walletService.creditServiceFee).not.toHaveBeenCalled();
    expect(ctx.notificationsService.send).not.toHaveBeenCalled();
  });

  it('charges no transfer fee when the platform rate is 0%', async () => {
    const ctx = buildService({ escrowTransferFeePercent: 0 });

    await ctx.service.donate(USER_ID, GROUP_ID.toString(), {});

    expect(ctx.walletService.debitForDonation).toHaveBeenCalledWith(
      new Types.ObjectId(USER_ID),
      1000,
      { donationGroup: GROUP_ID },
      reference,
      ctx.session,
      0,
    );
    expect(ctx.walletService.creditServiceFee).not.toHaveBeenCalled();
  });

  it('charges once when the same period is donated twice (double tap)', async () => {
    const duplicateKeyError = Object.assign(new Error('E11000 duplicate key'), {
      code: 11000,
    });
    const ctx = buildService({
      donationCreate: jest.fn().mockRejectedValue(duplicateKeyError),
    });
    jest
      .spyOn(ctx.service, 'getGroup')
      .mockResolvedValue({ alreadyDonated: true } as never);

    const result = await ctx.service.donate(USER_ID, GROUP_ID.toString(), {});

    expect(ctx.walletService.debitForDonation).not.toHaveBeenCalled();
    expect(result).toEqual({ alreadyDonated: true });
  });

  it('rejects donations to a closed pool', async () => {
    const ctx = buildService({
      group: makeGroup({ status: DonationGroupStatus.CLOSED }),
    });

    await expect(
      ctx.service.donate(USER_ID, GROUP_ID.toString(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.donationModel.create).not.toHaveBeenCalled();
  });

  it('rejects an amount that does not match a fixed pool', async () => {
    const ctx = buildService();

    await expect(
      ctx.service.donate(USER_ID, GROUP_ID.toString(), { amount: 500 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.walletService.debitForDonation).not.toHaveBeenCalled();
  });

  it('requires an explicit amount for a free-will pool', async () => {
    const ctx = buildService({
      group: makeGroup({
        amountType: DonationAmountType.FREE_WILL,
        amount: undefined,
      }),
    });

    await expect(
      ctx.service.donate(USER_ID, GROUP_ID.toString(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.walletService.debitForDonation).not.toHaveBeenCalled();
  });

  it('accepts the donor-chosen amount for a free-will pool', async () => {
    const ctx = buildService({
      group: makeGroup({
        amountType: DonationAmountType.FREE_WILL,
        amount: undefined,
      }),
      groupUpdated: makeGroup({ escrowBalance: 5200 }),
    });
    jest.spyOn(ctx.service, 'getGroup').mockResolvedValue({} as never);

    await ctx.service.donate(USER_ID, GROUP_ID.toString(), { amount: 200 });

    expect(ctx.walletService.debitForDonation).toHaveBeenCalledWith(
      new Types.ObjectId(USER_ID),
      200,
      { donationGroup: GROUP_ID },
      reference,
      ctx.session,
      // 1% of ₦200 → ₦2 platform transfer fee.
      2,
    );
  });

  it('requires membership before donating', async () => {
    const ctx = buildService({ member: null });

    await expect(
      ctx.service.donate(USER_ID, GROUP_ID.toString(), {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.walletService.debitForDonation).not.toHaveBeenCalled();
  });
});

describe('DonationsService.joinGroup', () => {
  it('joins by Group ID and increments the member count once', async () => {
    const ctx = buildService({ member: null });
    jest
      .spyOn(ctx.service, 'getGroup')
      .mockResolvedValue({ joined: true } as never);

    const result = await ctx.service.joinGroup(USER_ID, ' abc-23456 ');

    expect(ctx.donationGroupModel.findOne).toHaveBeenCalledWith({
      joinCode: 'ABC23456',
    });
    expect(ctx.donationMemberModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ group: GROUP_ID }),
    );
    expect(ctx.donationGroupModel.updateOne).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { $inc: { memberCount: 1 } },
    );
    expect(ctx.notificationsService.send).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ joined: true });
  });

  it('is a no-op for an existing member', async () => {
    const ctx = buildService();
    jest.spyOn(ctx.service, 'getGroup').mockResolvedValue({} as never);

    await ctx.service.joinGroup(USER_ID, 'ABC23456');

    expect(ctx.donationMemberModel.create).not.toHaveBeenCalled();
    expect(ctx.donationGroupModel.updateOne).not.toHaveBeenCalled();
    expect(ctx.notificationsService.send).not.toHaveBeenCalled();
  });

  it('rejects an unknown Group ID', async () => {
    const ctx = buildService();
    ctx.donationGroupModel.findOne.mockResolvedValue(null);

    await expect(
      ctx.service.joinGroup(USER_ID, 'ZZZZ9999'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects joining a closed pool', async () => {
    const ctx = buildService({
      group: makeGroup({ status: DonationGroupStatus.CLOSED }),
    });

    await expect(
      ctx.service.joinGroup(USER_ID, 'ABC23456'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.donationMemberModel.create).not.toHaveBeenCalled();
  });
});

describe('DonationsService.initiatePayout', () => {
  const poolAccount = {
    bankCode: '057',
    bankName: 'Zenith Bank',
    accountNumber: '9999999999',
    accountName: 'Chidi Admin',
    paystackRecipientCode: 'RCP_pool',
  };

  it('reserves escrow and pays the pool override account', async () => {
    const ctx = buildService({
      group: makeGroup({ escrowBalance: 5000, payoutAccount: poolAccount }),
      groupReserved: makeGroup({ escrowBalance: 4000 }),
    });
    const completePayout = jest
      .spyOn(ctx.service, 'completePayout')
      .mockResolvedValue(true);
    const transfers: Array<{
      amountNaira: number;
      recipientCode: string;
      reference: string;
      reason: string;
    }> = [];
    ctx.paystack.initiateTransfer.mockImplementation(
      (args: {
        amountNaira: number;
        recipientCode: string;
        reference: string;
        reason: string;
      }) => {
        transfers.push(args);
        return Promise.resolve({ status: 'success', transferCode: 'TRF_1' });
      },
    );

    await ctx.service.initiatePayout(ADMIN_ID, GROUP_ID.toString(), {
      amount: 1000,
    });

    expect(ctx.donationGroupModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: GROUP_ID, escrowBalance: { $gte: 1000 } },
      { $inc: { escrowBalance: -1000 } },
      { new: true, session: ctx.session },
    );

    expect(transfers).toHaveLength(1);
    const transferArgs = transfers[0];
    // 2.5% of ₦1,000 → ₦25 platform fee; the admin receives ₦975.
    expect(transferArgs).toMatchObject({
      amountNaira: 975,
      recipientCode: 'RCP_pool',
    });
    expect(ctx.donationPayoutModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          amount: 1000,
          fee: 25,
          netAmount: 975,
          status: TransferStatus.PENDING,
        }),
      ],
      { session: ctx.session },
    );
    // Escrow is debited the gross amount, not the net.
    expect(transferArgs.reference).toMatch(/^donation_payout_/);
    expect(transferArgs.reason).toContain("Chidi's Wedding Fund");
    expect(completePayout).toHaveBeenCalledWith(transferArgs.reference);

    expect(ctx.escrowTxModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: DonationEscrowTransactionType.PAYOUT_DEBIT,
          amount: 1000,
          balanceBefore: 5000,
          balanceAfter: 4000,
        }),
      ],
      { session: ctx.session },
    );
  });

  it("falls back to the admin's saved bank account", async () => {
    const ctx = buildService({
      group: makeGroup({ escrowBalance: 5000, payoutAccount: undefined }),
      groupReserved: makeGroup({ escrowBalance: 0 }),
      users: {
        [ADMIN_ID]: {
          _id: ADMIN_ID,
          name: 'Chidi',
          phone: '08031111111',
          bankAccount: {
            bankName: 'GTBank',
            bankCode: '058',
            accountNumber: '0123456789',
            accountName: 'Chidi Admin',
            paystackRecipientCode: 'RCP_admin',
          },
        },
      },
    });
    jest.spyOn(ctx.service, 'completePayout').mockResolvedValue(true);

    await ctx.service.initiatePayout(ADMIN_ID, GROUP_ID.toString(), {
      amount: 5000,
    });

    expect(ctx.paystack.initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientCode: 'RCP_admin',
        // 2.5% of ₦5,000 → ₦125 fee.
        amountNaira: 4875,
      }),
    );
  });

  it('pays the gross amount when the platform payout rate is 0%', async () => {
    const ctx = buildService({
      group: makeGroup({ escrowBalance: 5000, payoutAccount: poolAccount }),
      groupReserved: makeGroup({ escrowBalance: 0 }),
      payoutFeePercent: 0,
    });
    jest.spyOn(ctx.service, 'completePayout').mockResolvedValue(true);

    await ctx.service.initiatePayout(ADMIN_ID, GROUP_ID.toString(), {
      amount: 5000,
    });

    expect(ctx.paystack.initiateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({ amountNaira: 5000 }),
    );
  });

  it('refuses a payout that the platform fee would wipe out', async () => {
    const ctx = buildService({
      group: makeGroup({ escrowBalance: 5000, payoutAccount: poolAccount }),
      payoutFeePercent: 100,
    });

    await expect(
      ctx.service.initiatePayout(ADMIN_ID, GROUP_ID.toString(), {
        amount: 5000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.donationGroupModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(ctx.paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('refuses to pay out when no destination account is configured', async () => {
    const ctx = buildService({
      group: makeGroup({ payoutAccount: undefined }),
      users: null,
    });

    await expect(
      ctx.service.initiatePayout(ADMIN_ID, GROUP_ID.toString(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.donationGroupModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(ctx.paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('rejects an amount above the pool balance', async () => {
    const ctx = buildService({
      group: makeGroup({ escrowBalance: 5000, payoutAccount: poolAccount }),
    });

    await expect(
      ctx.service.initiatePayout(ADMIN_ID, GROUP_ID.toString(), {
        amount: 9000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(ctx.paystack.initiateTransfer).not.toHaveBeenCalled();
  });

  it('is admin-only', async () => {
    const ctx = buildService();

    await expect(
      ctx.service.initiatePayout(USER_ID, GROUP_ID.toString(), {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('DonationsService reward finalization', () => {
  it('credits totalPaidOut and notifies once on success', async () => {
    const ctx = buildService();

    const result = await ctx.service.completePayout('donation_payout_ref');

    expect(result).toBe(true);
    expect(ctx.donationPayoutModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: PAYOUT_ID, status: TransferStatus.PENDING },
      {
        $set: {
          status: TransferStatus.SUCCESS,
          completedAt: anyDate(),
        },
      },
      { new: true, session: ctx.session },
    );
    expect(ctx.donationGroupModel.updateOne).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      {
        $inc: { totalPaidOut: 1000 },
        $set: { lastPayoutAt: anyDate() },
      },
      { session: ctx.session },
    );
    expect(ctx.notificationsService.send).toHaveBeenCalledTimes(1);
  });

  it('credits the platform payout fee to the platform wallet on success', async () => {
    const ctx = buildService({
      payout: makePayout({ fee: 25, netAmount: 975 }),
    });

    await ctx.service.completePayout('donation_payout_ref');

    expect(ctx.walletService.creditServiceFee).toHaveBeenCalledWith(
      ADMIN_ID,
      25,
      {},
      ctx.session,
      expect.objectContaining({
        reference: `payout_fee_${PAYOUT_ID.toString()}`,
        // The fee credit records what the fee was charged against.
        metadata: expect.objectContaining({
          source: 'donation_payout_fee',
          grossAmount: 1000,
        }) as Record<string, unknown>,
      }),
    );
  });

  it('ignores a duplicate success webhook for an already-final payout', async () => {
    const ctx = buildService({
      payout: makePayout({ status: TransferStatus.SUCCESS }),
    });

    const result = await ctx.service.completePayout('donation_payout_ref');

    expect(result).toBe(true);
    expect(ctx.donationPayoutModel.findOneAndUpdate).not.toHaveBeenCalled();
    expect(ctx.donationGroupModel.updateOne).not.toHaveBeenCalled();
    expect(ctx.notificationsService.send).not.toHaveBeenCalled();
  });

  it('returns false for a reference that is not a pool payout', async () => {
    const ctx = buildService();
    ctx.donationPayoutModel.findOne.mockResolvedValue(null);

    await expect(ctx.service.completePayout('saving_withdraw_x')).resolves.toBe(
      false,
    );
  });

  it('refunds a failed PENDING payout back into escrow', async () => {
    const ctx = buildService({
      payout: makePayout({ status: TransferStatus.PENDING }),
      groupRefunded: makeGroup({ escrowBalance: 6000 }),
    });

    const result = await ctx.service.failPayout(
      'donation_payout_ref',
      'declined',
    );

    expect(result).toBe(true);
    expect(ctx.donationPayoutModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: PAYOUT_ID }),
      {
        $set: {
          status: TransferStatus.FAILED,
          failureReason: 'declined',
          completedAt: anyDate(),
        },
      },
      { new: true, session: ctx.session },
    );
    expect(ctx.donationGroupModel.findByIdAndUpdate).toHaveBeenCalledWith(
      GROUP_ID,
      { $inc: { escrowBalance: 1000 } },
      { new: true, session: ctx.session },
    );
    expect(ctx.escrowTxModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: DonationEscrowTransactionType.PAYOUT_REVERSAL_CREDIT,
          amount: 1000,
          balanceBefore: 5000,
          balanceAfter: 6000,
          reference: 'donation_payout_ref_reversal',
        }),
      ],
      { session: ctx.session },
    );
    expect(ctx.notificationsService.send).toHaveBeenCalledTimes(1);
  });

  it('claws the platform payout fee back when a successful payout is reversed', async () => {
    const ctx = buildService({
      payout: makePayout({
        status: TransferStatus.SUCCESS,
        fee: 25,
        netAmount: 975,
      }),
      groupRefunded: makeGroup({ escrowBalance: 1000, totalPaidOut: 0 }),
    });

    await ctx.service.reversePayout('donation_payout_ref');

    expect(ctx.walletService.reverseServiceFeeCredit).toHaveBeenCalledWith(
      ADMIN_ID,
      25,
      {},
      ctx.session,
      expect.objectContaining({
        reference: `payout_fee_reversal_${PAYOUT_ID.toString()}`,
      }),
    );
  });

  it('rolls totalPaidOut back when a successful payout is reversed', async () => {
    const ctx = buildService({
      payout: makePayout({ status: TransferStatus.SUCCESS }),
      groupRefunded: makeGroup({ escrowBalance: 1000, totalPaidOut: 0 }),
    });

    const result = await ctx.service.reversePayout('donation_payout_ref');

    expect(result).toBe(true);
    expect(ctx.donationPayoutModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: PAYOUT_ID }),
      {
        $set: {
          status: TransferStatus.REVERSED,
          failureReason: 'Transfer reversed by the bank',
          completedAt: anyDate(),
        },
      },
      { new: true, session: ctx.session },
    );
    expect(ctx.donationGroupModel.findByIdAndUpdate).toHaveBeenCalledWith(
      GROUP_ID,
      { $inc: { escrowBalance: 1000, totalPaidOut: -1000 } },
      { new: true, session: ctx.session },
    );
  });
});

describe('DonationsService.listDonations pagination', () => {
  const donationRow = {
    _id: new Types.ObjectId(),
    group: GROUP_ID,
    user: new Types.ObjectId(USER_ID),
    amount: 1000,
    period: '2026-10',
    reference: 'don_1',
    createdAt: new Date(),
  };

  /** Wires `find()` so skip/limit can be asserted. */
  function spyDonationQuery(
    model: ReturnType<typeof buildService>['donationModel'],
  ) {
    const lean = jest.fn().mockResolvedValue([donationRow]);
    const limit = jest.fn().mockReturnValue({ lean });
    const skip = jest.fn().mockReturnValue({ limit });
    const sort = jest.fn().mockReturnValue({ skip });
    model.find.mockReturnValue({ sort });
    return { skip, limit };
  }

  it('pages 10 rows at a time and names the donors', async () => {
    const ctx = buildService({
      donationTotal: 23,
      donationRows: [donationRow],
    });
    const { skip, limit } = spyDonationQuery(ctx.donationModel);

    const first = await ctx.service.listDonations(
      USER_ID,
      GROUP_ID.toString(),
      {},
    );

    expect(first).toMatchObject({
      page: 1,
      limit: 10,
      total: 23,
      totalPages: 3,
      totalCollected: 5000,
    });
    expect(first.donations[0]).toMatchObject({
      donorName: 'Ada',
      amount: 1000,
    });
    expect(skip).toHaveBeenLastCalledWith(0);
    expect(limit).toHaveBeenLastCalledWith(10);

    const third = await ctx.service.listDonations(
      USER_ID,
      GROUP_ID.toString(),
      { page: 99, limit: 10 },
    );

    expect(third).toMatchObject({ page: 3 });
    expect(skip).toHaveBeenLastCalledWith(20);
  });

  it('caps an oversized page size', async () => {
    const ctx = buildService({
      donationTotal: 200,
      donationRows: [donationRow],
    });
    const { limit } = spyDonationQuery(ctx.donationModel);

    const result = await ctx.service.listDonations(
      USER_ID,
      GROUP_ID.toString(),
      { limit: 500 },
    );

    expect(result.limit).toBe(50);
    expect(limit).toHaveBeenLastCalledWith(50);
  });
});

describe('DonationsService termination vote', () => {
  /**
   * One-time pool with three fully paid members and one who has never
   * donated. Only the three who paid 100% of their contribution count, so
   * 2/3 of them = 2 yes votes are needed.
   */
  function oneTimePool(overrides: Record<string, unknown> = {}) {
    const members = [
      makeMember({
        _id: new Types.ObjectId(),
        user: new Types.ObjectId(USER_ID),
        donationCount: 1,
        totalDonated: 1000,
      }),
      makeMember({
        _id: new Types.ObjectId(),
        user: new Types.ObjectId(ADMIN_ID),
        donationCount: 1,
        totalDonated: 1000,
      }),
      makeMember({
        _id: new Types.ObjectId(),
        user: new Types.ObjectId(THIRD_ID),
        donationCount: 1,
        totalDonated: 1000,
      }),
      makeMember({
        _id: new Types.ObjectId(),
        user: new Types.ObjectId(FOURTH_ID),
        donationCount: 0,
      }),
    ];

    return {
      members,
      group: makeGroup({
        schedule: DonationSchedule.ONE_TIME,
        frequency: undefined,
        ...overrides,
      }),
    };
  }

  it('lets a fully paid member vote and exposes the tally on the pool', async () => {
    // The switch starts off; voting again is idempotent at the DB level
    // ($addToSet), so the mocked group already carries the vote.
    const { members, group } = oneTimePool({
      terminationVotes: [new Types.ObjectId(USER_ID)],
    });
    const ctx = buildService({ group, donationMembers: members });

    const result = await ctx.service.voteOnTermination(
      USER_ID,
      GROUP_ID.toString(),
      true,
    );

    expect(ctx.donationGroupModel.updateOne).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { $addToSet: { terminationVotes: new Types.ObjectId(USER_ID) } },
    );
    expect((result as { termination: unknown }).termination).toMatchObject({
      myVote: true,
      eligible: true,
      eligibleCount: 3,
      votes: 1,
      requiredVotes: 2,
      votesMet: false,
      totalCollected: 5000,
      totalPaidOut: 0,
      fundsUtilized: false,
      canTerminate: false,
      terminated: false,
      percentVoted: 33,
    });
  });

  it('withdraws the vote when the toggle is switched off', async () => {
    const { members, group } = oneTimePool({
      terminationVotes: [new Types.ObjectId(USER_ID)],
    });
    const ctx = buildService({ group, donationMembers: members });

    const result = await ctx.service.voteOnTermination(
      USER_ID,
      GROUP_ID.toString(),
      false,
    );

    expect(ctx.donationGroupModel.updateOne).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { $pull: { terminationVotes: new Types.ObjectId(USER_ID) } },
    );
    expect((result as { termination: unknown }).termination).toMatchObject({
      eligibleCount: 3,
      votes: 1,
    });
  });

  it('rejects a vote from a member who has not paid 100%', async () => {
    const { members, group } = oneTimePool();
    const ctx = buildService({ group, donationMembers: members });

    await expect(
      ctx.service.voteOnTermination(FOURTH_ID, GROUP_ID.toString(), true),
    ).rejects.toThrow(BadRequestException);
    expect(ctx.donationGroupModel.updateOne).not.toHaveBeenCalled();
  });

  it('rejects votes once the pool has been terminated', async () => {
    const { members, group } = oneTimePool({
      status: DonationGroupStatus.TERMINATED,
    });
    const ctx = buildService({ group, donationMembers: members });

    await expect(
      ctx.service.voteOnTermination(USER_ID, GROUP_ID.toString(), true),
    ).rejects.toThrow('This pool has already been terminated.');
  });

  it('refuses to terminate before 2/3 of the fully paid members voted yes', async () => {
    const { members, group } = oneTimePool({
      terminationVotes: [new Types.ObjectId(USER_ID)],
      escrowBalance: 0,
      totalCollected: 3000,
      totalPaidOut: 3000,
    });
    const ctx = buildService({ group, donationMembers: members });

    await expect(
      ctx.service.terminateGroup(ADMIN_ID, GROUP_ID.toString()),
    ).rejects.toThrow('1 of 2 votes so far');
    expect(ctx.connection.startSession).not.toHaveBeenCalled();
    expect(ctx.donationGroupModel.deleteOne).not.toHaveBeenCalled();
  });

  it('deletes the pool and every pool-scoped record at exactly 2/3 once paid out', async () => {
    const { members, group } = oneTimePool({
      terminationVotes: [
        new Types.ObjectId(USER_ID),
        new Types.ObjectId(ADMIN_ID),
      ],
      // Everything donated has already left escrow — the pool is spent.
      escrowBalance: 0,
      totalCollected: 3000,
      totalPaidOut: 3000,
    });
    const ctx = buildService({ group, donationMembers: members });

    const result = await ctx.service.terminateGroup(
      ADMIN_ID,
      GROUP_ID.toString(),
    );

    // One transaction, every collection that holds pool-scoped rows.
    expect(ctx.session.withTransaction).toHaveBeenCalledTimes(1);
    expect(ctx.escrowTxModel.deleteMany).toHaveBeenCalledWith(
      { group: GROUP_ID },
      { session: ctx.session },
    );
    expect(ctx.donationPayoutModel.deleteMany).toHaveBeenCalledWith(
      { group: GROUP_ID },
      { session: ctx.session },
    );
    expect(ctx.donationModel.deleteMany).toHaveBeenCalledWith(
      { group: GROUP_ID },
      { session: ctx.session },
    );
    expect(ctx.donationMemberModel.deleteMany).toHaveBeenCalledWith(
      { group: GROUP_ID },
      { session: ctx.session },
    );
    expect(ctx.donationGroupModel.deleteOne).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { session: ctx.session },
    );
    expect(ctx.session.endSession).toHaveBeenCalled();

    // No soft-termination state is left behind.
    expect(ctx.donationGroupModel.updateOne).not.toHaveBeenCalled();
    expect(result).toEqual({
      groupId: GROUP_ID.toString(),
      status: DonationGroupStatus.TERMINATED,
    });

    expect(ctx.notificationsService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: NotificationType.DONATION_POOL_TERMINATED,
        userIds: anyOf([USER_ID, ADMIN_ID, THIRD_ID, FOURTH_ID]),
      }),
    );
  });

  it('refuses to terminate while donated money is still in the pool', async () => {
    const { members, group } = oneTimePool({
      terminationVotes: [
        new Types.ObjectId(USER_ID),
        new Types.ObjectId(ADMIN_ID),
      ],
      escrowBalance: 2000,
      totalCollected: 3000,
      totalPaidOut: 1000,
    });
    const ctx = buildService({ group, donationMembers: members });

    // The vote is there, but the money has not been used yet.
    const detail = await ctx.service.getGroup(ADMIN_ID, GROUP_ID.toString());
    expect((detail as { termination: unknown }).termination).toMatchObject({
      votes: 2,
      requiredVotes: 2,
      votesMet: true,
      totalCollected: 3000,
      totalPaidOut: 1000,
      fundsUtilized: false,
      canTerminate: false,
    });

    await expect(
      ctx.service.terminateGroup(ADMIN_ID, GROUP_ID.toString()),
    ).rejects.toThrow('has not been paid out yet');
    expect(ctx.donationGroupModel.deleteOne).not.toHaveBeenCalled();
    expect(ctx.donationModel.deleteMany).not.toHaveBeenCalled();
  });

  it('only lets the pool admin terminate the pool', async () => {
    const { members, group } = oneTimePool({
      terminationVotes: [
        new Types.ObjectId(USER_ID),
        new Types.ObjectId(ADMIN_ID),
      ],
      escrowBalance: 0,
      totalCollected: 3000,
      totalPaidOut: 3000,
    });
    const ctx = buildService({ group, donationMembers: members });

    await expect(
      ctx.service.terminateGroup(USER_ID, GROUP_ID.toString()),
    ).rejects.toThrow('Only the pool admin can perform this action.');
    expect(ctx.donationGroupModel.deleteOne).not.toHaveBeenCalled();
    expect(ctx.notificationsService.send).not.toHaveBeenCalled();
  });

  it('purges a legacy terminated pool only when asked to (dry run by default)', async () => {
    const legacy = [
      {
        ...makeGroup({
          status: DonationGroupStatus.TERMINATED,
          escrowBalance: 0,
          totalCollected: 3000,
          totalPaidOut: 3000,
        }),
      },
    ];
    const ctx = buildService({ terminatedPools: legacy });

    const report = await ctx.service.purgeTerminatedPools();

    expect(report).toEqual({
      scanned: 1,
      purged: [{ id: GROUP_ID.toString(), name: "Chidi's Wedding Fund" }],
      skipped: [],
    });
    expect(ctx.donationGroupModel.deleteOne).not.toHaveBeenCalled();

    const applied = await ctx.service.purgeTerminatedPools({ dryRun: false });

    expect(applied.purged).toHaveLength(1);
    expect(ctx.donationGroupModel.deleteOne).toHaveBeenCalledWith(
      { _id: GROUP_ID },
      { session: ctx.session },
    );
    expect(ctx.donationModel.deleteMany).toHaveBeenCalled();
    expect(ctx.donationMemberModel.deleteMany).toHaveBeenCalled();
  });

  it('skips a legacy terminated pool whose escrow still holds money', async () => {
    const legacy = [
      {
        ...makeGroup({
          status: DonationGroupStatus.TERMINATED,
          escrowBalance: 1500,
          totalCollected: 3000,
          totalPaidOut: 1500,
        }),
      },
    ];
    const ctx = buildService({ terminatedPools: legacy });

    const report = await ctx.service.purgeTerminatedPools({ dryRun: false });

    expect(report.purged).toHaveLength(0);
    expect(report.skipped).toEqual([
      { id: GROUP_ID.toString(), name: "Chidi's Wedding Fund", balance: 1500 },
    ]);
    expect(ctx.donationGroupModel.deleteOne).not.toHaveBeenCalled();
  });

  it('only counts members paid for the current period on a recurring pool', async () => {
    const members = [
      makeMember({ user: new Types.ObjectId(USER_ID), donationCount: 2 }),
      makeMember({ user: new Types.ObjectId(ADMIN_ID), donationCount: 0 }),
      makeMember({ user: new Types.ObjectId(THIRD_ID), donationCount: 0 }),
    ];
    // Members who have not paid this period are not eligible, even if they
    // are in `terminationVotes` — their vote is ignored rather than deleted.
    const ctx = buildService({
      group: makeGroup({
        terminationVotes: [
          new Types.ObjectId(USER_ID),
          new Types.ObjectId(ADMIN_ID),
        ],
        // Paid out in full so the funds gate is open and only the vote and
        // this-period eligibility matter to this test.
        escrowBalance: 0,
        totalCollected: 2000,
        totalPaidOut: 2000,
      }),
      donationMembers: members,
      periodDonors: [{ user: new Types.ObjectId(USER_ID) }],
    });

    const result = await ctx.service.getGroup(USER_ID, GROUP_ID.toString());

    expect(ctx.donationModel.find).toHaveBeenCalledWith({
      group: GROUP_ID,
      period: currentPeriodKey(
        DonationSchedule.INTERVAL,
        DonationFrequency.MONTHLY,
      ),
    });
    expect((result as { termination: unknown }).termination).toMatchObject({
      myVote: true,
      eligible: true,
      eligibleCount: 1,
      votes: 1,
      // 2/3 of one member rounds up to one vote.
      requiredVotes: 1,
      votesMet: true,
      fundsUtilized: true,
      canTerminate: true,
      percentVoted: 100,
    });
  });
});
