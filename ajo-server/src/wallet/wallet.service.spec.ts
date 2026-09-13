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
  findByPhone?: jest.Mock;
  findById?: jest.Mock;
  createCustomer?: jest.Mock;
  createDedicatedAccount?: jest.Mock;
  fetchDedicatedAccounts?: jest.Mock;
  dvaPreferredBank?: jest.Mock;
  sendNotification?: jest.Mock;
}) {
  const walletModel = {} as never;
  const walletTxModel = {
    findOne: overrides.walletTxFindOne ?? jest.fn(),
    create: overrides.createWalletTx ?? jest.fn().mockResolvedValue({}),
  } as never;
  const usersService = {
    findById: overrides.findById ?? jest.fn(),
    findByPhone: overrides.findByPhone ?? jest.fn(),
  } as never;
  const paystack = {
    createCustomer: overrides.createCustomer ?? jest.fn(),
    createDedicatedAccount: overrides.createDedicatedAccount ?? jest.fn(),
    fetchDedicatedAccounts: overrides.fetchDedicatedAccounts ?? jest.fn(),
    dvaPreferredBank:
      overrides.dvaPreferredBank ?? jest.fn().mockReturnValue('wema'),
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

  it('throws NotFound when the user does not exist', async () => {
    const { service } = buildService({
      findById: jest.fn().mockResolvedValue(null),
    });
    await expect(
      service.getOrCreateDedicatedAccount(USER_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a Paystack customer + DVA on first use and persists it', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      name: 'Jane Doe',
      email: 'jane@x.com',
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

    expect(createCustomer).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      phone: PHONE,
      email: 'jane@x.com',
    });
    expect(createDedicatedAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        customerCode: 'CUS_abc123',
        preferredBank: 'wema',
        phone: PHONE,
      }),
    );
    expect(result.accountNumber).toBe('5900000001');
    expect(result.active).toBe(true);
    expect(save).toHaveBeenCalled(); // persisted on the user
  });

  it('recovers the existing assignment when the customer already has a DVA', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    const user = {
      _id: new Types.ObjectId(),
      phone: PHONE,
      dedicatedAccount: { paystackCustomerCode: 'CUS_abc123', active: false },
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
    });

    const result = await service.getOrCreateDedicatedAccount(USER_ID);

    expect(fetchDedicatedAccounts).toHaveBeenCalledWith('CUS_abc123');
    expect(result.accountNumber).toBe('5900000001');
    expect(save).toHaveBeenCalled();
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

    const { service } = buildService({
      walletTxFindOne: jest.fn().mockResolvedValue(null),
      createWalletTx,
      findByPhone: jest.fn().mockResolvedValue(user),
      sendNotification: send,
    });

    jest.spyOn(service, 'getOrCreateWallet').mockResolvedValue(wallet as never);

    const credited = await service.creditDedicatedAccountFunding({
      phone: PHONE,
      amountNaira: 5000,
      reference: 'JB300000111',
    });

    expect(credited).toBe(true);
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
      findByPhone: jest
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

  it('returns false when no user matches the phone', async () => {
    const { service } = buildService({
      findByPhone: jest.fn().mockResolvedValue(null),
    });

    const credited = await service.creditDedicatedAccountFunding({
      phone: '+2348999999999',
      amountNaira: 5000,
      reference: 'JB300000222',
    });

    expect(credited).toBe(false);
  });
});
