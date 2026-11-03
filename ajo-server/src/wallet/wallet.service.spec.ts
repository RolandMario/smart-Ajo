import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { WalletService } from './wallet.service';

/**
 * Focused unit tests for the Dedicated Virtual Account (DVA) funding
 * feature: lazy account provisioning (getOrCreateDedicatedAccount) and
 * idempotent wallet credits for inbound transfers
 * (creditDedicatedAccountFunding).
 */

const USER_ID = new Types.ObjectId().toString();
const PHONE = '+2348012345678';

function buildService(overrides: {
  walletTxFindOne?: jest.Mock;
  createWalletTx?: jest.Mock;
  findByDedicatedAccountIdentity?: jest.Mock;
  findById?: jest.Mock;
  createCustomer?: jest.Mock;
  fetchCustomer?: jest.Mock;
  fetchCustomerByEmail?: jest.Mock;
  createDedicatedAccount?: jest.Mock;
  fetchDedicatedAccounts?: jest.Mock;
  dvaPreferredBank?: jest.Mock;
  keyMode?: jest.Mock;
  sendNotification?: jest.Mock;
}) {
  const walletModel = {} as never;
  const walletTxModel = {
    findOne: overrides.walletTxFindOne ?? jest.fn(),
    create: overrides.createWalletTx ?? jest.fn().mockResolvedValue({}),
  } as never;
  const usersService = {
    findById: overrides.findById ?? jest.fn(),
    findByPhone: jest.fn(),
    findByDedicatedAccountIdentity:
      overrides.findByDedicatedAccountIdentity ?? jest.fn(),
  } as never;
  const paystack = {
    assertConfigured: jest.fn(),
    keyMode: overrides.keyMode ?? jest.fn().mockReturnValue('test'),
    createCustomer: overrides.createCustomer ?? jest.fn(),
    fetchCustomer: overrides.fetchCustomer ?? jest.fn().mockResolvedValue(null),
    fetchCustomerByEmail:
      overrides.fetchCustomerByEmail ?? jest.fn().mockResolvedValue(null),
    isDuplicateCustomerError: jest.fn().mockReturnValue(false),
    createDedicatedAccount: overrides.createDedicatedAccount ?? jest.fn(),
    fetchDedicatedAccounts: overrides.fetchDedicatedAccounts ?? jest.fn(),
    dvaPreferredBank:
      overrides.dvaPreferredBank ?? jest.fn().mockReturnValue('wema-bank'),
  } as never;
  const notificationsService = {
    send: overrides.sendNotification ?? jest.fn(),
  } as never;

  const service = new WalletService(
    walletModel,
    walletTxModel,
    {} as never,
    usersService,
    paystack,
    notificationsService,
  );

  return { service, walletTxModel };
}

function dediAccount(overrides: Record<string, unknown> = {}) {
  return {
    paystackCustomerCode: 'CUS_abc123',
    paystackCustomerEmail: 'jane@x.com',
    paystackMode: 'test',
    paystackAccountId: '9989123',
    accountNumber: '5900000001',
    accountName: 'Jane Doe/9989123',
    bankName: 'Wema Bank',
    provider: 'paystack',
    currency: 'NGN',
    active: true,
    ...overrides,
  };
}

describe('WalletService.getOrCreateDedicatedAccount', () => {
  it('returns the stored active account without calling Paystack', async () => {
    const stored = dediAccount();
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      dedicatedAccount: stored,
      save: jest.fn(),
    };
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(user),
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    expect(result).toBe(stored);
  });

  it('keeps (and backfills) a legacy active account that predates `paystackMode`', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const stored = dediAccount({ paystackMode: undefined });
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      dedicatedAccount: stored,
      save,
    };
    const createCustomer = jest.fn();
    const fetchCustomer = jest
      .fn()
      .mockResolvedValue({ customerCode: 'CUS_abc123' });

    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(user),
      keyMode: jest.fn().mockReturnValue('live'),
      fetchCustomer,
      createCustomer,
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    // The existing number is preserved (members may be transferring to it)
    // and the mode is recorded so the check is cheap next time.
    expect(result.accountNumber).toBe('5900000001');
    expect(result.paystackMode).toBe('live');
    expect(createCustomer).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });

  it('throws NotFound when the user does not exist', async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.getOrCreateDedicatedAccount(USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates an Ajo-owned Paystack customer + DVA on first use and persists it', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      name: 'Jane Doe',
      email: 'Jane@X.com',
      save,
    };
    const createCustomer = jest
      .fn()
      .mockResolvedValue({ customerCode: 'CUS_abc123' });
    const createDedicatedAccount = jest.fn().mockResolvedValue({
      accountId: '9989123',
      accountNumber: '5900000001',
      accountName: 'Jane Doe/9989123',
      bankName: 'Wema Bank',
      currency: 'NGN',
      active: true,
    });

    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(user),
      createCustomer,
      createDedicatedAccount,
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    // The customer is tagged as Ajo's own and the email is normalised. No
    // phone is attached: another product may legitimately share the number.
    expect(createCustomer).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@x.com',
      metadata: { app: 'ajo', userId: user._id.toString() },
    });
    expect(createDedicatedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        customerCode: 'CUS_abc123',
        preferredBank: 'wema-bank',
        phone: PHONE,
      }),
    );
    expect(result.accountNumber).toBe('5900000001');
    expect(result.active).toBe(true);
    expect(result.paystackMode).toBe('test');
    expect(save).toHaveBeenCalled(); // persisted on the user
  });

  it('adopts the existing assignment when the customer already has a DVA', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      name: 'Jane Doe',
      email: 'jane@x.com',
      dedicatedAccount: {
        paystackCustomerCode: 'CUS_abc123',
        paystackMode: 'test',
        active: false,
      },
      save,
    };
    const createDedicatedAccount = jest
      .fn()
      .mockRejectedValue(new Error('Customer already has a dedicated account'));
    const fetchDedicatedAccounts = jest.fn().mockResolvedValue([dediAccount()]);

    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(user),
      createDedicatedAccount,
      fetchDedicatedAccounts,
      fetchCustomer: jest
        .fn()
        .mockResolvedValue({ customerCode: 'CUS_abc123' }),
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    expect(fetchDedicatedAccounts).toHaveBeenCalledWith('CUS_abc123');
    expect(result.accountNumber).toBe('5900000001');
    expect(save).toHaveBeenCalled();
  });

  it('re-provisions when the stored account was minted in the other Paystack mode', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      name: 'Jane Doe',
      email: 'jane@x.com',
      // Minted with the test key; the server is now running live, where this
      // code no longer exists ("Customer not found").
      dedicatedAccount: dediAccount({ paystackMode: 'test' }),
      save,
    };
    const fetchCustomer = jest.fn();
    const createCustomer = jest
      .fn()
      .mockResolvedValue({ customerCode: 'CUS_live123' });
    const createDedicatedAccount = jest.fn().mockResolvedValue({
      accountId: '5550001',
      accountNumber: '9817686278',
      accountName: 'JANE DOE',
      bankName: 'Wema Bank',
      currency: 'NGN',
      active: true,
    });

    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(user),
      keyMode: jest.fn().mockReturnValue('live'),
      fetchCustomer,
      createCustomer,
      createDedicatedAccount,
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    // The stale test-mode code is never queried in live mode.
    expect(fetchCustomer).not.toHaveBeenCalled();
    expect(createCustomer).toHaveBeenCalled();
    expect(result).toMatchObject({
      paystackCustomerCode: 'CUS_live123',
      paystackMode: 'live',
      accountNumber: '9817686278',
    });
  });

  it("mints a separate Ajo customer (email alias) when the member's email already owns a DVA", async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: new Types.ObjectId('64b7f9c2a1b2c3d4e5f60789'),
      phone: PHONE,
      name: 'Jane Doe',
      email: 'jane@x.com',
      save,
    };
    const fetchCustomerByEmail = jest
      .fn()
      // 1st: the member's real email belongs to another product's customer…
      .mockResolvedValueOnce({
        customerCode: 'CUS_shared',
        email: 'jane@x.com',
      })
      // 2nd: nothing exists for the alias yet.
      .mockResolvedValueOnce(null);
    const fetchDedicatedAccounts = jest
      .fn()
      .mockResolvedValue([dediAccount({ accountNumber: '9817686278' })]);
    const createCustomer = jest
      .fn()
      .mockResolvedValue({ customerCode: 'CUS_ajo' });
    const createDedicatedAccount = jest.fn().mockResolvedValue({
      accountId: '5550002',
      accountNumber: '9817686001',
      accountName: 'JANE DOE',
      bankName: 'Wema Bank',
      currency: 'NGN',
      active: true,
    });

    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(user),
      fetchCustomerByEmail,
      fetchDedicatedAccounts,
      createCustomer,
      createDedicatedAccount,
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    const aliasEmail = (
      createCustomer.mock.calls[0] as unknown as [{ email: string }]
    )[0].email;

    expect(aliasEmail).toBe('jane+ajof60789@x.com');
    expect(createDedicatedAccount).toHaveBeenCalledWith(
      expect.objectContaining({ customerCode: 'CUS_ajo' }),
    );
    // Ajo does NOT adopt the other product's account number.
    expect(result.accountNumber).toBe('9817686001');
    expect(result.paystackCustomerCode).toBe('CUS_ajo');
  });

  it('reuses an existing customer when its email has no DVA yet', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      name: 'Jane Doe',
      email: 'jane@x.com',
      save,
    };
    const createCustomer = jest.fn();
    const fetchCustomerByEmail = jest
      .fn()
      .mockResolvedValue({ customerCode: 'CUS_existing', email: 'jane@x.com' });
    const createDedicatedAccount = jest.fn().mockResolvedValue({
      accountId: '5550003',
      accountNumber: '9817686002',
      accountName: 'JANE DOE',
      bankName: 'Wema Bank',
      currency: 'NGN',
      active: true,
    });

    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(user),
      fetchCustomerByEmail,
      fetchDedicatedAccounts: jest.fn().mockResolvedValue([]),
      createCustomer,
      createDedicatedAccount,
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    expect(createCustomer).not.toHaveBeenCalled();
    expect(createDedicatedAccount).toHaveBeenCalledWith(
      expect.objectContaining({ customerCode: 'CUS_existing' }),
    );
    expect(result.paystackCustomerCode).toBe('CUS_existing');
  });

  it('requires an email address before creating an account', async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        phone: PHONE,
        name: 'Jane Doe',
        save: jest.fn(),
      }),
    });

    await expect(service.getOrCreateDedicatedAccount(USER_ID)).rejects.toThrow(
      /email address is required/i,
    );
  });
});

describe('WalletService.creditDedicatedAccountFunding', () => {
  function walletStub() {
    return {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      balance: 1000,
      currency: 'NGN',
      save: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('credits the wallet and records a SUCCESS FUNDING entry', async () => {
    const wallet = walletStub();
    const createWalletTx = jest.fn().mockResolvedValue({});
    const user = { _id: wallet.user, phone: PHONE };
    const send = jest.fn();
    const findByDedicatedAccountIdentity = jest.fn().mockResolvedValue(user);

    const { service } = buildService({
      walletTxFindOne: jest.fn().mockResolvedValue(null),
      createWalletTx,
      findByDedicatedAccountIdentity,
      sendNotification: send,
    });

    jest.spyOn(service, 'getOrCreateWallet').mockResolvedValue(wallet as never);

    const credited = await service.creditDedicatedAccountFunding({
      customerCode: 'CUS_ajo',
      accountNumber: '9817686278',
      // Paystack sends the local format while the member is stored in E.164.
      phone: '08012345678',
      amountNaira: 5000,
      reference: 'JB300000111',
    });

    expect(credited).toBe(true);
    // Every identifier Paystack sent is handed to the resolver, which
    // normalises the phone across Nigerian formats.
    expect(findByDedicatedAccountIdentity).toHaveBeenCalledWith({
      customerCode: 'CUS_ajo',
      accountNumber: '9817686278',
      phone: '08012345678',
    });
    expect(wallet.balance).toBe(6000);
    expect(wallet.save).toHaveBeenCalledTimes(1);
    expect(createWalletTx).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'funding',
        status: 'success',
        amount: 5000,
        balanceBefore: 1000,
        balanceAfter: 6000,
        reference: 'JB300000111',
        metadata: { source: 'dedicated_account' },
      }),
    );
    expect(send).toHaveBeenCalled();
  });

  it('does not double-credit when the reference was already processed', async () => {
    const wallet = walletStub();
    const createWalletTx = jest.fn();
    const { service } = buildService({
      walletTxFindOne: jest
        .fn()
        .mockResolvedValue({ reference: 'JB300000111', status: 'success' }),
      createWalletTx,
      findByDedicatedAccountIdentity: jest
        .fn()
        .mockResolvedValue({ _id: wallet.user, phone: PHONE }),
    });

    jest.spyOn(service, 'getOrCreateWallet').mockResolvedValue(wallet as never);

    const credited = await service.creditDedicatedAccountFunding({
      phone: PHONE,
      amountNaira: 5000,
      reference: 'JB300000111',
    });

    expect(credited).toBe(false);
    expect(wallet.balance).toBe(1000);
    expect(createWalletTx).not.toHaveBeenCalled();
  });

  it('returns false when no member matches the transfer', async () => {
    const { service } = buildService({
      findByDedicatedAccountIdentity: jest.fn().mockResolvedValue(null),
    });

    const credited = await service.creditDedicatedAccountFunding({
      customerCode: 'CUS_unknown',
      accountNumber: '9999999999',
      phone: '+2348999999999',
      amountNaira: 5000,
      reference: 'JB300000222',
    });

    expect(credited).toBe(false);
  });
});

/**
 * Cashback lives on the same Wallet document but in its own `cashbackBalance`,
 * so the money-safety rules are different from the other ledger entries:
 * earning is idempotent per bill, paying from it leaves the main balance
 * alone, and a failed payment goes back to the cashback balance.
 */
describe('WalletService cashback wallet', () => {
  const SESSION = {} as never;

  function buildCashbackService(options: {
    wallet: Record<string, unknown>;
    pendingBillTx?: Record<string, unknown> | null;
    creditedTx?: Record<string, unknown> | null;
  }) {
    const walletTxModel = {
      findOne: jest.fn(() => ({
        session: () => Promise.resolve(options.creditedTx ?? null),
      })),
      create: jest.fn(() => Promise.resolve([])),
      updateOne: jest.fn(),
      find: jest.fn(() => ({
        sort: () => ({
          limit: () => ({ lean: () => Promise.resolve([]) }),
        }),
      })),
    };
    const walletModel = {
      findOne: jest.fn(() => ({
        session: () => Promise.resolve(options.wallet),
      })),
      findById: jest.fn(() => ({
        session: () => Promise.resolve(options.wallet),
      })),
    };

    // A pending bill entry is only returned by the failure path's lookup.
    if (options.pendingBillTx !== undefined) {
      walletTxModel.findOne.mockImplementation(() => ({
        session: () => Promise.resolve(options.pendingBillTx ?? null),
      }));
    }

    const service = new WalletService(
      walletModel as never,
      walletTxModel as never,
      {} as never,
      {} as never,
      {} as never,
      { send: jest.fn() } as never,
    );

    return { service, walletModel, walletTxModel };
  }

  function walletDoc(overrides: Record<string, unknown> = {}) {
    return {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(USER_ID),
      balance: 500,
      cashbackBalance: 0,
      currency: 'NGN',
      save: jest.fn(() => Promise.resolve()),
      ...overrides,
    };
  }

  it('credits earned cashback without touching the main balance', async () => {
    const wallet = walletDoc();
    const { service, walletTxModel } = buildCashbackService({ wallet });

    await service.creditBillCashback(
      USER_ID,
      0.5,
      {
        billReference: 'bill_1',
        billType: 'data',
        cashbackPercent: 0.5,
        purchaseAmount: 100,
      },
      SESSION,
    );

    expect(wallet.cashbackBalance).toBe(0.5);
    expect(wallet.balance).toBe(500);
    expect(walletTxModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: 'cashback_credit',
          amount: 0.5,
          balanceBefore: 0,
          balanceAfter: 0.5,
          reference: 'cb_bill_1',
        }),
      ],
      { session: SESSION },
    );
  });

  it('is idempotent per bill reference', async () => {
    const wallet = walletDoc({ cashbackBalance: 5 });
    const { service, walletTxModel } = buildCashbackService({
      wallet,
      creditedTx: { reference: 'cb_bill_1' },
    });

    await service.creditBillCashback(
      USER_ID,
      0.5,
      {
        billReference: 'bill_1',
        billType: 'data',
        cashbackPercent: 0.5,
        purchaseAmount: 100,
      },
      SESSION,
    );

    expect(wallet.cashbackBalance).toBe(5);
    expect(wallet.save).not.toHaveBeenCalled();
    expect(walletTxModel.create).not.toHaveBeenCalled();
  });

  it('pays a bill out of the cashback balance when asked', async () => {
    const wallet = walletDoc({ balance: 18.97, cashbackBalance: 68.25 });
    const { service, walletTxModel } = buildCashbackService({ wallet });

    const tx = await service.debitForBillPayment(
      new Types.ObjectId(USER_ID),
      50,
      'bill_2',
      { type: 'data' },
      SESSION,
      { source: 'cashback' },
    );

    expect(tx).not.toBeNull();
    expect(wallet.cashbackBalance).toBe(18.25);
    expect(wallet.balance).toBe(18.97);
    expect(walletTxModel.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          type: 'cashback_debit',
          status: 'pending',
          amount: 50,
          balanceBefore: 68.25,
          balanceAfter: 18.25,
        }),
      ],
      { session: SESSION },
    );

    // The ledger row records which wallet paid, so a failure refunds it back.
    const [[createdEntry]] = walletTxModel.create.mock.calls[0] as unknown as [
      [{ metadata?: Record<string, unknown> }],
      unknown,
    ];
    expect(createdEntry.metadata).toEqual({
      type: 'data',
      walletSource: 'cashback',
    });
  });

  it('refuses a cashback payment the balance cannot cover', async () => {
    const wallet = walletDoc({ balance: 1000, cashbackBalance: 10 });
    const { service, walletTxModel } = buildCashbackService({ wallet });

    const tx = await service.debitForBillPayment(
      new Types.ObjectId(USER_ID),
      50,
      'bill_3',
      { type: 'data' },
      SESSION,
      { source: 'cashback' },
    );

    expect(tx).toBeNull();
    expect(wallet.cashbackBalance).toBe(10);
    expect(wallet.balance).toBe(1000);
    expect(walletTxModel.create).not.toHaveBeenCalled();
  });

  it('refunds a failed cashback payment back to the cashback balance', async () => {
    const wallet = walletDoc({ balance: 500, cashbackBalance: 18.25 });
    const billTx = {
      wallet: wallet._id,
      user: new Types.ObjectId(USER_ID),
      type: 'cashback_debit',
      amount: 50,
      status: 'pending',
      save: jest.fn(() => Promise.resolve()),
    };
    const { service } = buildCashbackService({
      wallet,
      pendingBillTx: billTx,
    });

    await service.failBillPayment('bill_2', 50, SESSION);

    expect(wallet.cashbackBalance).toBe(68.25);
    expect(wallet.balance).toBe(500);
    expect(billTx.status).toBe('failed');
  });
});
