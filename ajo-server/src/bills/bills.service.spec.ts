import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { BillsService } from './bills.service';

/**
 * Bills logic after the Gladtidings removal. VTPass is the only provider, so
 * these tests lock in the three things that keep member money safe:
 *
 *  1. the price charged is the catalogue price, never the client's `amount`;
 *  2. a plan the admin switched OFF cannot be vended;
 *  3. an unconfigured VTpass key pair answers 503 before any wallet debit.
 */

interface PlanDoc {
  name: string;
  amount: number;
  isActive: boolean;
  /** Admin's cashback rate for a stored plan row. */
  cashbackPercent?: number;
}

/** A `BillServicePlan` row as `liveCatalogue` reads it. */
interface PlanRow {
  externalId: string;
  isActive?: boolean;
  cashbackPercent?: number;
}

/**
 * Chainable stand-in for a Mongoose `Query`, so both `find(...).lean()` and
 * `find(...).sort().skip().limit().lean()` (admin plan list) work when the
 * service plan model is mocked.
 */
function planQuery(rows: unknown) {
  const query = {
    sort: () => query,
    skip: () => query,
    limit: () => query,
    lean: () => Promise.resolve(rows),
  };
  return query;
}

function buildService(
  options: {
    configured?: boolean;
    missing?: string[];
    plan?: PlanDoc | null;
    /** Stored rows for the bucket: hidden plans + cashback rates. */
    planRows?: PlanRow[];
    serviceTypes?: Array<{ _id: string; total: number; active: number }>;
    /** Bill transaction rows returned by `find()` / `findOne()`. */
    billTransactionRows?: Record<string, unknown>[];
  } = {},
) {
  const {
    configured = true,
    missing = [],
    plan = { name: 'DStv Compact', amount: 19000, isActive: true },
    planRows = [],
    serviceTypes = [],
    billTransactionRows = [],
  } = options;

  const vtpass = {
    isConfigured: jest.fn(() => configured),
    missingConfig: jest.fn(() => missing),
    purchaseAirtime: jest.fn(),
    purchaseData: jest.fn(),
    purchaseCable: jest.fn(),
    purchaseElectricity: jest.fn(),
    verifyProduct: jest.fn(),
    getServiceVariations: jest.fn(),
  };

  const walletService = {
    debitForBillPayment: jest.fn(() =>
      Promise.resolve({ _id: new Types.ObjectId() }),
    ),
    confirmBillPayment: jest.fn(),
    creditBillCommission: jest.fn(),
    creditBillCashback: jest.fn(),
    failBillPayment: jest.fn(),
    getWalletSummary: jest.fn(() => Promise.resolve({})),
  };

  const usersService = {
    findById: jest.fn(() =>
      Promise.resolve({ _id: new Types.ObjectId(), phone: '0803' }),
    ),
    findPlatformAdmin: jest.fn(() =>
      Promise.resolve({ _id: new Types.ObjectId() }),
    ),
  };

  const notificationsService = { send: jest.fn() };

  const session = {
    withTransaction: jest.fn(async (fn: () => Promise<unknown>) => fn()),
    endSession: jest.fn(() => Promise.resolve()),
  };
  const connection = { startSession: jest.fn(() => Promise.resolve(session)) };

  const providerConfigModel = {
    find: jest.fn(() => ({ lean: () => Promise.resolve([]) })),
  };

  /** Stand-in `BillServicePlanDocument` for `setPlanCashback` tests. */
  const editablePlan = {
    _id: new Types.ObjectId(),
    serviceType: 'data',
    provider: 'vtpass',
    name: 'MTN 110MB Daily',
    bucket: 'MTN',
    amount: 100,
    isActive: true,
    cashbackPercent: 0,
    save: jest.fn(() => Promise.resolve()),
  };

  const servicePlanModel = {
    findOne: jest.fn(() => ({
      lean: () => Promise.resolve(plan),
    })),
    find: jest.fn(() => planQuery(planRows)),
    countDocuments: jest.fn(() => Promise.resolve(planRows.length)),
    findById: jest.fn(
      (): Promise<typeof editablePlan | null> => Promise.resolve(editablePlan),
    ),
    aggregate: jest.fn(() => Promise.resolve(serviceTypes)),
  };

  const billTransactionModel = {
    create: jest.fn(() =>
      Promise.resolve([{ _id: new Types.ObjectId(), createdAt: new Date() }]),
    ),
    find: jest.fn(() => planQuery(billTransactionRows)),
    findOne: jest.fn(() => ({
      lean: () => Promise.resolve(billTransactionRows[0] ?? null),
    })),
  };

  const service = new BillsService(
    vtpass as never,
    walletService as never,
    usersService as never,
    notificationsService as never,
    connection as never,
    providerConfigModel as never,
    servicePlanModel as never,
    billTransactionModel as never,
  );

  return {
    service,
    vtpass,
    walletService,
    usersService,
    servicePlanModel,
    billTransactionModel,
    editablePlan,
    session,
  };
}

const USER_ID = new Types.ObjectId().toHexString();

const cableDto = {
  serviceProvider: 'dstv',
  smartCardNumber: '1234567890',
  variationCode: 'dstv79',
  customerName: 'JANE DOE',
};

/** A slice of what `GET service-variations?serviceID=dstv` returns. */
const DSTV_PLANS = [
  {
    variationCode: 'dstv79',
    name: 'DStv Compact',
    amount: 19000,
    fixedPrice: true,
  },
  {
    variationCode: 'dstv-padi',
    name: 'DStv Padi',
    amount: 4400,
    fixedPrice: true,
  },
  {
    variationCode: 'dstv-yanga',
    name: 'DStv Yanga',
    amount: 6000,
    fixedPrice: true,
  },
];

/**
 * The same bouquets as VTpass actually returns them: every name carries its
 * price ("DStv Compact N19,000"), which is what the API layer strips.
 */
const DSTV_LIVE_PLANS = [
  {
    variationCode: 'dstv79',
    name: 'DStv Compact N19,000',
    amount: 19000,
    fixedPrice: true,
  },
  {
    variationCode: 'dstv-padi',
    name: 'DStv Padi N4,400',
    amount: 4400,
    fixedPrice: true,
  },
];

/** StartTimes puts the price mid-name: "Nova - 900 Naira - 1 Month". */
const STARTIMES_LIVE_PLANS = [
  {
    variationCode: 'nova',
    name: 'Nova - 900 Naira - 1 Month',
    amount: 900,
    fixedPrice: true,
  },
  {
    variationCode: 'nova-weekly',
    name: 'Nova - 300 Naira - 1 Week',
    amount: 300,
    fixedPrice: true,
  },
];

describe('BillsService configuration guard', () => {
  it('answers 503 naming the missing VTpass variables', async () => {
    const { service, walletService } = buildService({
      configured: false,
      missing: ['VTPASS_API_KEY'],
    });

    await expect(service.purchaseCable(USER_ID, cableDto)).rejects.toThrow(
      ServiceUnavailableException,
    );

    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
  });
});

describe('BillsService.purchaseCable', () => {
  it('charges the live catalogue price, not the stale synced copy', async () => {
    const { service, walletService, vtpass } = buildService({
      plan: { name: 'DStv Compact', amount: 9999, isActive: true },
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_PLANS);
    vtpass.purchaseCable.mockResolvedValue({
      requestId: 'req-1',
      externalTransactionId: 'tx-1',
      status: 'delivered',
      commission: 190,
    });

    const receipt = await service.purchaseCable(USER_ID, cableDto);

    expect(vtpass.getServiceVariations).toHaveBeenCalledWith('dstv');
    expect(receipt.amount).toBe(19000);
    expect(receipt.provider).toBe('vtpass');
    expect(walletService.debitForBillPayment).toHaveBeenCalledWith(
      expect.anything(),
      19000,
      expect.stringContaining('bill_'),
      expect.objectContaining({ type: 'cable', variationCode: 'dstv79' }),
      expect.anything(),
      { source: 'main' },
    );
    expect(vtpass.purchaseCable).toHaveBeenCalledWith({
      serviceID: 'dstv',
      billersCode: '1234567890',
      amount: 19000,
      phone: '0803',
      variationCode: 'dstv79',
    });
  });

  it('refuses a bouquet the admin switched off', async () => {
    const { service, walletService, vtpass } = buildService({
      plan: { name: 'DStv Compact', amount: 19000, isActive: false },
      planRows: [{ externalId: 'dstv79', isActive: false }],
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_PLANS);

    await expect(service.purchaseCable(USER_ID, cableDto)).rejects.toThrow(
      'DStv Compact is currently unavailable',
    );
    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
  });

  it('rejects a bouquet VTpass no longer sells', async () => {
    const { service, walletService, vtpass } = buildService({ plan: null });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_PLANS);

    await expect(
      service.purchaseCable(USER_ID, {
        ...cableDto,
        variationCode: 'dstv-retired-bouquet',
      }),
    ).rejects.toThrow('Invalid cable plan selected');
    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
  });

  it('requires a bouquet code before pricing anything', async () => {
    const { service, servicePlanModel, vtpass } = buildService();

    await expect(
      service.purchaseCable(USER_ID, { ...cableDto, variationCode: '' }),
    ).rejects.toThrow(BadRequestException);
    expect(vtpass.getServiceVariations).not.toHaveBeenCalled();
    expect(servicePlanModel.findOne).not.toHaveBeenCalled();
  });

  it('refunds the wallet debit when the VTpass vend fails', async () => {
    const { service, walletService, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(DSTV_PLANS);
    vtpass.purchaseCable.mockRejectedValue(new Error('VTpass exploded'));

    await expect(service.purchaseCable(USER_ID, cableDto)).rejects.toThrow(
      'VTpass exploded',
    );

    expect(walletService.failBillPayment).toHaveBeenCalledTimes(1);
    expect(walletService.confirmBillPayment).not.toHaveBeenCalled();
  });
});

describe('BillsService.renewCable', () => {
  const renewDto = {
    serviceProvider: 'dstv',
    smartCardNumber: '1234567890',
    customerName: 'JANE DOE',
  };

  const vended = {
    requestId: 'req-renew-1',
    externalTransactionId: 'tx-renew-1',
    status: 'delivered',
    commission: 190,
  };

  it('renews the bouquet the decoder is on, without a variation code', async () => {
    const { service, vtpass, walletService } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'DStv Compact N19,000',
      outstanding: 19000,
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_LIVE_PLANS);
    vtpass.purchaseCable.mockResolvedValue(vended);

    const receipt = await service.renewCable(USER_ID, renewDto);

    expect(vtpass.verifyProduct).toHaveBeenCalledWith({
      serviceID: 'dstv',
      billersCode: '1234567890',
    });
    expect(receipt.amount).toBe(19000);
    expect(walletService.debitForBillPayment).toHaveBeenCalledWith(
      expect.anything(),
      19000,
      expect.stringContaining('bill_'),
      expect.objectContaining({
        type: 'cable',
        renewal: true,
        planName: 'DStv Compact',
        variationCode: 'dstv79',
      }),
      expect.anything(),
      { source: 'main' },
    );
    // DSTV renews from the amount alone — a variation_code could switch the
    // member onto a different bouquet instead of extending the current one.
    expect(vtpass.purchaseCable).toHaveBeenCalledWith({
      serviceID: 'dstv',
      billersCode: '1234567890',
      amount: 19000,
      phone: '0803',
      renewCurrentBouquet: true,
    });
  });

  it('charges the amount VTpass will bill, not the bouquet list price', async () => {
    const { service, vtpass } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'DStv Compact',
      // A part-month/add-on balance — deliberately below the ₦19,000 list price.
      outstanding: 7500,
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_LIVE_PLANS);
    vtpass.purchaseCable.mockResolvedValue(vended);

    const receipt = await service.renewCable(USER_ID, renewDto);

    expect(receipt.amount).toBe(7500);
    expect(vtpass.purchaseCable).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 7500 }),
    );
  });

  it('falls back to the bouquet price when no renewal amount is reported', async () => {
    const { service, vtpass } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'DStv Compact',
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_LIVE_PLANS);
    vtpass.purchaseCable.mockResolvedValue(vended);

    const receipt = await service.renewCable(USER_ID, renewDto);

    expect(receipt.amount).toBe(19000);
  });

  it('sends the bouquet code for a StartTimes renewal', async () => {
    const { service, vtpass } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'Nova',
      outstanding: 900,
    });
    vtpass.getServiceVariations.mockResolvedValue(STARTIMES_LIVE_PLANS);
    vtpass.purchaseCable.mockResolvedValue(vended);

    const receipt = await service.renewCable(USER_ID, {
      serviceProvider: 'startimes',
      smartCardNumber: '1234567890',
    });

    expect(receipt.metadata).toMatchObject({
      planName: 'Nova - 1 Month',
      renewal: true,
    });
    expect(vtpass.purchaseCable).toHaveBeenCalledWith({
      serviceID: 'startimes',
      billersCode: '1234567890',
      amount: 900,
      phone: '0803',
      variationCode: 'nova',
      renewCurrentBouquet: true,
    });
  });

  it('refuses a StartTimes renewal whose bouquet is not in the catalogue', async () => {
    const { service, vtpass, walletService } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'Discontinued Bouquet',
      outstanding: 900,
    });
    vtpass.getServiceVariations.mockResolvedValue(STARTIMES_LIVE_PLANS);

    await expect(
      service.renewCable(USER_ID, {
        serviceProvider: 'startimes',
        smartCardNumber: '1234567890',
      }),
    ).rejects.toThrow('Could not find your current StartTimes bouquet');

    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
    expect(vtpass.purchaseCable).not.toHaveBeenCalled();
  });

  it('refuses a smart card with no active subscription', async () => {
    const { service, vtpass, walletService } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_LIVE_PLANS);

    await expect(service.renewCable(USER_ID, renewDto)).rejects.toThrow(
      'no active subscription to renew',
    );

    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
    expect(vtpass.purchaseCable).not.toHaveBeenCalled();
  });

  it('passes the provider rejection through without charging', async () => {
    const { service, vtpass, walletService } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: false,
      message: 'The Smartcard/Decoder Number you entered may be invalid',
    });

    await expect(service.renewCable(USER_ID, renewDto)).rejects.toThrow(
      /may be invalid/,
    );

    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
    expect(vtpass.purchaseCable).not.toHaveBeenCalled();
  });

  it('refuses a renewal whose price moved after it was displayed', async () => {
    const { service, vtpass, walletService } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'DStv Compact',
      outstanding: 20000,
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_LIVE_PLANS);

    await expect(
      service.renewCable(USER_ID, { ...renewDto, expectedAmount: 19000 }),
    ).rejects.toThrow('The renewal price has changed to ₦20,000');

    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
    expect(vtpass.purchaseCable).not.toHaveBeenCalled();
  });

  it('refunds the wallet debit when the renewal vend fails', async () => {
    const { service, vtpass, walletService } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'DStv Compact',
      outstanding: 19000,
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_LIVE_PLANS);
    vtpass.purchaseCable.mockRejectedValue(new Error('VTpass exploded'));

    await expect(service.renewCable(USER_ID, renewDto)).rejects.toThrow(
      'VTpass exploded',
    );

    expect(walletService.failBillPayment).toHaveBeenCalledTimes(1);
    expect(walletService.confirmBillPayment).not.toHaveBeenCalled();
  });

  it('rejects an unknown provider before verifying anything', async () => {
    const { service, vtpass } = buildService();

    await expect(
      service.renewCable(USER_ID, {
        serviceProvider: 'showmax',
        smartCardNumber: '1234567890',
      }),
    ).rejects.toThrow('Unknown cable provider');

    expect(vtpass.verifyProduct).not.toHaveBeenCalled();
  });
});

describe('BillsService.purchaseElectricity', () => {
  it('rejects an amount below the ₦500 floor', async () => {
    const { service, walletService } = buildService();

    await expect(
      service.purchaseElectricity(USER_ID, {
        disco: 'ikedc',
        meterNumber: '04123456789',
        meterType: 'prepaid',
        amount: 100,
      }),
    ).rejects.toThrow('Electricity payments must be between ₦500 and ₦500,000');

    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
  });

  it('maps the disco to its VTpass serviceID and the meter type to variation_code', async () => {
    const { service, vtpass } = buildService();
    vtpass.purchaseElectricity.mockResolvedValue({
      requestId: 'req-2',
      externalTransactionId: 'tx-2',
      status: 'delivered',
      commission: 50,
      providerData: { token: '1234' },
    });

    const receipt = await service.purchaseElectricity(USER_ID, {
      disco: 'ikedc',
      meterNumber: '04123456789',
      meterType: 'prepaid',
      amount: 5000,
    });

    expect(receipt.amount).toBe(5000);
    expect(receipt.metadata).toMatchObject({
      providerDetails: { token: '1234' },
    });
    expect(vtpass.purchaseElectricity).toHaveBeenCalledWith({
      serviceID: 'ikeja-electric',
      billersCode: '04123456789',
      amount: 5000,
      phone: '0803',
      variationCode: 'prepaid',
    });
  });

  /**
   * VTpass marks `phone` mandatory on the electricity payload (the token SMS
   * goes there). The app no longer asks for it, so the account number must be
   * used — and an account without one must fail before the wallet is debited.
   */
  it("sends the member's account phone when the app sends none", async () => {
    const { service, vtpass, usersService } = buildService();
    usersService.findById.mockResolvedValue({
      _id: new Types.ObjectId(),
      phone: '08031234567',
    });
    vtpass.purchaseElectricity.mockResolvedValue({
      requestId: 'req-3',
      externalTransactionId: 'tx-3',
      status: 'delivered',
      commission: 50,
    });

    await service.purchaseElectricity(USER_ID, {
      disco: 'ekedc',
      meterNumber: '04123456789',
      meterType: 'postpaid',
      amount: 2000,
    });

    expect(vtpass.purchaseElectricity).toHaveBeenCalledWith({
      serviceID: 'eko-electric',
      billersCode: '04123456789',
      amount: 2000,
      phone: '08031234567',
      variationCode: 'postpaid',
    });
  });

  it('refuses to vend when neither the account nor the request has a phone', async () => {
    const { service, vtpass, walletService, usersService } = buildService();
    usersService.findById.mockResolvedValue({
      _id: new Types.ObjectId(),
      phone: '',
    });

    await expect(
      service.purchaseElectricity(USER_ID, {
        disco: 'ikedc',
        meterNumber: '04123456789',
        meterType: 'prepaid',
        amount: 5000,
      }),
    ).rejects.toThrow('Your profile has no phone number on file');

    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
    expect(vtpass.purchaseElectricity).not.toHaveBeenCalled();
  });
});

describe('BillsService.getActiveServiceTypes', () => {
  it('hides a category whose plans are all switched off', async () => {
    const { service } = buildService({
      serviceTypes: [{ _id: 'data', total: 3, active: 0 }],
    });

    await expect(service.getActiveServiceTypes()).resolves.toEqual([
      'airtime',
      'cable',
      'electricity',
    ]);
  });

  it('keeps categories that were never synced (live catalogue bootstrap)', async () => {
    const { service } = buildService({ serviceTypes: [] });

    await expect(service.getActiveServiceTypes()).resolves.toEqual([
      'airtime',
      'data',
      'cable',
      'electricity',
    ]);
  });

  it('keeps a category while at least one plan is live', async () => {
    const { service } = buildService({
      serviceTypes: [{ _id: 'data', total: 12, active: 4 }],
    });

    await expect(service.getActiveServiceTypes()).resolves.toContain('data');
  });
});

/** A slice of what `GET service-variations?serviceID=mtn-data` returns. */
const MTN_PLANS = [
  {
    variationCode: 'mtn-3.5gb-1500',
    name: 'MTN 3.5GB Weekly Plan (7 Days)',
    amount: 1500,
    fixedPrice: true,
  },
  {
    variationCode: 'mtn-110mb-100',
    name: 'MTN 110MB Daily Plan (1 Day)',
    amount: 100,
    fixedPrice: true,
  },
];

describe('BillsService.validateSmartCard', () => {
  it('returns the verified customer under `name` for the member app', async () => {
    const { service, vtpass } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'TEST METER',
      packageInfo: 'DStv Compact',
      outstanding: 19000,
    });

    const result = await service.validateSmartCard('dstv', '1212121212');

    expect(vtpass.verifyProduct).toHaveBeenCalledWith({
      serviceID: 'dstv',
      billersCode: '1212121212',
    });
    expect(result).toMatchObject({
      valid: true,
      name: 'TEST METER',
      packageInfo: 'DStv Compact',
      outstanding: 19000,
    });
  });

  it('strips the price VTpass leaves in the current bouquet name', async () => {
    const { service, vtpass } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'DStv Compact N19,000',
      outstanding: 19000,
    });

    const result = await service.validateSmartCard('dstv', '1212121212');

    expect(result.packageInfo).toBe('DStv Compact');
    expect(result.outstanding).toBe(19000);
  });

  it('passes the provider rejection reason through to the member', async () => {
    const { service, vtpass } = buildService();
    vtpass.verifyProduct.mockResolvedValue({
      valid: false,
      message: 'The Smartcard/Decoder Number you entered may be invalid',
    });

    await expect(
      service.validateSmartCard('dstv', '0000000000'),
    ).rejects.toThrow(/may be invalid/);
  });
});

describe('BillsService.getDataPlans', () => {
  it('returns the live VTpass catalogue, cheapest first', async () => {
    const { service, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    const plans = await service.getDataPlans('mtn');

    expect(vtpass.getServiceVariations).toHaveBeenCalledWith('mtn-data');
    expect(plans).toEqual([
      {
        variationCode: 'mtn-110mb-100',
        name: 'MTN 110MB Daily Plan (1 Day)',
        amount: 100,
        fixedPrice: true,
        cashbackPercent: 0,
        cashback: 0,
      },
      {
        variationCode: 'mtn-3.5gb-1500',
        name: 'MTN 3.5GB Weekly Plan (7 Days)',
        amount: 1500,
        fixedPrice: true,
        cashbackPercent: 0,
        cashback: 0,
      },
    ]);
  });

  it('renders the cashback each plan earns', async () => {
    const { service, vtpass } = buildService({
      planRows: [
        { externalId: 'mtn-110mb-100', isActive: true, cashbackPercent: 0.5 },
        { externalId: 'mtn-3.5gb-1500', isActive: true, cashbackPercent: 2 },
      ],
    });
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    const plans = await service.getDataPlans('mtn');

    expect(plans).toEqual([
      expect.objectContaining({
        variationCode: 'mtn-110mb-100',
        cashbackPercent: 0.5,
        cashback: 0.5, // ₦100 × 0.5%
      }),
      expect.objectContaining({
        variationCode: 'mtn-3.5gb-1500',
        cashbackPercent: 2,
        cashback: 30, // ₦1,500 × 2%
      }),
    ]);
  });

  it('maps 9mobile to the etisalat-data serviceID', async () => {
    const { service, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue([]);

    await service.getDataPlans('9mobile');

    expect(vtpass.getServiceVariations).toHaveBeenCalledWith('etisalat-data');
  });

  it('hides plans the admin switched off', async () => {
    const { service, vtpass } = buildService({
      planRows: [{ externalId: 'mtn-110mb-100', isActive: false }],
    });
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    const plans = await service.getDataPlans('mtn');

    expect(plans.map((p) => p.variationCode)).toEqual(['mtn-3.5gb-1500']);
  });

  it('reuses the live catalogue instead of re-querying VTpass', async () => {
    const { service, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    await service.getDataPlans('mtn');
    await service.getDataPlans('mtn');

    expect(vtpass.getServiceVariations).toHaveBeenCalledTimes(1);
  });

  it('picks up a cashback rate saved after the catalogue was cached', async () => {
    // Regression: the cashback map used to be cached with the VTpass list, so a
    // rate the admin set in the console stayed invisible on the plan cards for
    // the rest of the cache window — members saw no "₦x back" at all.
    const { service, vtpass, servicePlanModel } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    const before = await service.getDataPlans('mtn');
    expect(before.every((plan) => plan.cashback === 0)).toBe(true);

    // The admin saves 5% on the ₦100 bundle while the catalogue is still warm.
    servicePlanModel.find.mockImplementation(() =>
      planQuery([
        { externalId: 'mtn-110mb-100', isActive: true, cashbackPercent: 5 },
      ]),
    );

    const after = await service.getDataPlans('mtn');

    expect(vtpass.getServiceVariations).toHaveBeenCalledTimes(1); // still cached
    const bundle = after.find((plan) => plan.variationCode === 'mtn-110mb-100');
    expect(bundle).toMatchObject({ cashbackPercent: 5, cashback: 5 });
  });

  it('hides a plan the admin switches off while the catalogue is cached', async () => {
    const { service, vtpass, servicePlanModel } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    expect((await service.getDataPlans('mtn')).length).toBe(2);

    servicePlanModel.find.mockImplementation(() =>
      planQuery([{ externalId: 'mtn-110mb-100', isActive: false }]),
    );

    const plans = await service.getDataPlans('mtn');
    expect(plans.map((p) => p.variationCode)).toEqual(['mtn-3.5gb-1500']);
  });

  it('rejects an unknown network before calling VTpass', async () => {
    const { service, vtpass } = buildService();

    await expect(service.getDataPlans('mtn-data')).rejects.toThrow(
      'Unknown data network',
    );
    expect(vtpass.getServiceVariations).not.toHaveBeenCalled();
  });
});

describe('BillsService.getCablePlans', () => {
  it('returns the live VTpass bouquets instead of the synced rows', async () => {
    // A stale row for a bouquet VTpass has re-priced must not be served.
    const { service, vtpass } = buildService({
      plan: { name: 'DStv Compact', amount: 9999, isActive: true },
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_PLANS);

    const plans = await service.getCablePlans('dstv');

    expect(vtpass.getServiceVariations).toHaveBeenCalledWith('dstv');
    expect(plans).toEqual([
      {
        variationCode: 'dstv-padi',
        name: 'DStv Padi',
        amount: 4400,
        fixedPrice: true,
        cashbackPercent: 0,
        cashback: 0,
      },
      {
        variationCode: 'dstv-yanga',
        name: 'DStv Yanga',
        amount: 6000,
        fixedPrice: true,
        cashbackPercent: 0,
        cashback: 0,
      },
      {
        variationCode: 'dstv79',
        name: 'DStv Compact',
        amount: 19000,
        fixedPrice: true,
        cashbackPercent: 0,
        cashback: 0,
      },
    ]);
  });

  it('strips the price VTpass puts inside each bouquet name', async () => {
    const { service, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(DSTV_LIVE_PLANS);

    const plans = await service.getCablePlans('dstv');

    expect(plans.map((p) => p.name)).toEqual(['DStv Padi', 'DStv Compact']);
    expect(plans.map((p) => p.amount)).toEqual([4400, 19000]);
  });

  it('drops a price that sits mid-name (StartTimes)', async () => {
    const { service, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(STARTIMES_LIVE_PLANS);

    const plans = await service.getCablePlans('startimes');

    expect(plans.map((p) => p.name)).toEqual([
      'Nova - 1 Week',
      'Nova - 1 Month',
    ]);
  });

  it('hides bouquets the admin switched off', async () => {
    const { service, vtpass } = buildService({
      planRows: [{ externalId: 'dstv-padi', isActive: false }],
    });
    vtpass.getServiceVariations.mockResolvedValue(DSTV_PLANS);

    const plans = await service.getCablePlans('dstv');

    expect(plans.map((p) => p.variationCode)).toEqual(['dstv-yanga', 'dstv79']);
  });

  it('asks VTpass for the startimes catalogue', async () => {
    const { service, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue([]);

    await service.getCablePlans('startimes');

    expect(vtpass.getServiceVariations).toHaveBeenCalledWith('startimes');
  });

  it('keeps the data and cable catalogues apart in the cache', async () => {
    const { service, vtpass } = buildService();
    vtpass.getServiceVariations.mockImplementation((serviceId: string) =>
      Promise.resolve(serviceId === 'mtn-data' ? MTN_PLANS : DSTV_PLANS),
    );

    const data = await service.getDataPlans('mtn');
    const cable = await service.getCablePlans('dstv');

    expect(data.map((p) => p.variationCode)).toEqual([
      'mtn-110mb-100',
      'mtn-3.5gb-1500',
    ]);
    expect(cable.map((p) => p.variationCode)).toEqual([
      'dstv-padi',
      'dstv-yanga',
      'dstv79',
    ]);
  });

  it('rejects an unknown provider before calling VTpass', async () => {
    const { service, vtpass } = buildService();

    await expect(service.getCablePlans('showmax')).rejects.toThrow(
      'Unknown cable provider',
    );
    expect(vtpass.getServiceVariations).not.toHaveBeenCalled();
  });
});

describe('BillsService.purchaseData', () => {
  it('charges the live VTpass price instead of the synced copy', async () => {
    const { service, walletService, vtpass } = buildService({
      plan: { name: 'MTN 3.5GB Weekly', amount: 9999, isActive: true },
    });
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);
    vtpass.purchaseData.mockResolvedValue({
      requestId: 'req-3',
      externalTransactionId: 'tx-3',
      status: 'delivered',
      commission: 15,
    });

    const receipt = await service.purchaseData(USER_ID, {
      phone: '08030000000',
      dataPlanId: 'mtn-3.5gb-1500',
      network: 'mtn',
    });

    expect(receipt.amount).toBe(1500);
    expect(receipt.metadata).toMatchObject({
      type: 'data',
      variationCode: 'mtn-3.5gb-1500',
      planName: 'MTN 3.5GB Weekly Plan (7 Days)',
    });
    expect(walletService.debitForBillPayment).toHaveBeenCalledWith(
      expect.anything(),
      1500,
      expect.stringContaining('bill_'),
      expect.objectContaining({
        type: 'data',
        variationCode: 'mtn-3.5gb-1500',
      }),
      expect.anything(),
      { source: 'main' },
    );
    expect(vtpass.purchaseData).toHaveBeenCalledWith({
      serviceID: 'mtn-data',
      phone: '08030000000',
      variationCode: 'mtn-3.5gb-1500',
    });
  });

  it('refuses a data plan the admin switched off', async () => {
    const { service, walletService, vtpass } = buildService({
      plan: { name: 'MTN 110MB Daily', amount: 100, isActive: false },
      planRows: [{ externalId: 'mtn-110mb-100', isActive: false }],
    });
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    await expect(
      service.purchaseData(USER_ID, {
        phone: '08030000000',
        dataPlanId: 'mtn-110mb-100',
        network: 'mtn',
      }),
    ).rejects.toThrow('MTN 110MB Daily is currently unavailable');
    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
  });

  it('rejects a plan code VTpass does not sell', async () => {
    const { service, walletService, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    await expect(
      service.purchaseData(USER_ID, {
        phone: '08030000000',
        dataPlanId: 'mtn-not-a-plan',
        network: 'mtn',
      }),
    ).rejects.toThrow('Invalid data plan selected');
    expect(walletService.debitForBillPayment).not.toHaveBeenCalled();
  });
});

describe('BillsService cashback', () => {
  it('credits the plan cashback after a successful purchase', async () => {
    const { service, walletService, vtpass } = buildService({
      planRows: [
        { externalId: 'mtn-110mb-100', isActive: true, cashbackPercent: 0.5 },
      ],
    });
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);
    vtpass.purchaseData.mockResolvedValue({
      requestId: 'req-1',
      externalTransactionId: 'tx-1',
      status: 'delivered',
      commission: 2,
    });

    const receipt = await service.purchaseData(USER_ID, {
      phone: '08030000000',
      dataPlanId: 'mtn-110mb-100',
      network: 'mtn',
    });

    // ₦100 × 0.5% = ₦0.50, credited to the cashback wallet.
    expect(walletService.creditBillCashback).toHaveBeenCalledWith(
      USER_ID,
      0.5,
      expect.objectContaining({
        billType: 'data',
        cashbackPercent: 0.5,
        purchaseAmount: 100,
      }),
      expect.anything(),
    );
    expect(receipt.metadata).toMatchObject({
      cashbackEarned: 0.5,
      cashbackPercent: 0.5,
    });
  });

  it('credits nothing when the plan has no cashback configured', async () => {
    const { service, walletService, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);
    vtpass.purchaseData.mockResolvedValue({
      requestId: 'req-1',
      status: 'delivered',
      commission: 2,
    });

    const receipt = await service.purchaseData(USER_ID, {
      phone: '08030000000',
      dataPlanId: 'mtn-110mb-100',
      network: 'mtn',
    });

    expect(walletService.creditBillCashback).not.toHaveBeenCalled();
    expect(receipt.metadata).not.toHaveProperty('cashbackEarned');
  });

  it('never credits cashback when the vend fails', async () => {
    const { service, walletService, vtpass } = buildService({
      planRows: [
        { externalId: 'mtn-110mb-100', isActive: true, cashbackPercent: 5 },
      ],
    });
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);
    vtpass.purchaseData.mockRejectedValue(new Error('VTpass is down'));

    await expect(
      service.purchaseData(USER_ID, {
        phone: '08030000000',
        dataPlanId: 'mtn-110mb-100',
        network: 'mtn',
      }),
    ).rejects.toThrow('VTpass is down');

    expect(walletService.creditBillCashback).not.toHaveBeenCalled();
    expect(walletService.failBillPayment).toHaveBeenCalledTimes(1);
  });

  it('debits the cashback wallet when the member pays from it', async () => {
    const { service, walletService, vtpass } = buildService();
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);
    vtpass.purchaseData.mockResolvedValue({
      requestId: 'req-1',
      status: 'delivered',
      commission: 2,
    });

    await service.purchaseData(USER_ID, {
      phone: '08030000000',
      dataPlanId: 'mtn-110mb-100',
      network: 'mtn',
      paymentSource: 'cashback',
    });

    expect(walletService.debitForBillPayment).toHaveBeenCalledWith(
      expect.anything(),
      100,
      expect.stringContaining('bill_'),
      expect.objectContaining({ type: 'data' }),
      expect.anything(),
      { source: 'cashback' },
    );
  });
});

describe('BillsService.estimateCashback', () => {
  it('prices a data quote from the live catalogue', async () => {
    const { service, vtpass } = buildService({
      planRows: [
        { externalId: 'mtn-110mb-100', isActive: true, cashbackPercent: 2 },
      ],
    });
    vtpass.getServiceVariations.mockResolvedValue(MTN_PLANS);

    const quote = await service.estimateCashback({
      serviceType: 'data',
      provider: 'mtn',
      variationCode: 'mtn-110mb-100',
      // A client-sent amount must never change a fixed-price plan's quote.
      amount: 999,
    });

    expect(quote).toEqual({
      serviceType: 'data',
      purchaseAmount: 100,
      cashbackPercent: 2,
      cashback: 2,
    });
  });

  it('prices an airtime quote from the network cashback rate', async () => {
    const { service } = buildService({
      plan: { name: 'MTN', amount: 0, isActive: true, cashbackPercent: 1 },
    });

    const quote = await service.estimateCashback({
      serviceType: 'airtime',
      provider: 'mtn',
      amount: 1000,
    });

    expect(quote).toEqual({
      serviceType: 'airtime',
      purchaseAmount: 1000,
      cashbackPercent: 1,
      cashback: 10,
    });
  });

  it('prices an electricity quote from the disco cashback rate', async () => {
    const { service } = buildService({
      plan: {
        name: 'IKEDC',
        amount: 0,
        isActive: true,
        cashbackPercent: 0.5,
      },
    });

    const quote = await service.estimateCashback({
      serviceType: 'electricity',
      provider: 'ikedc',
      amount: 5000,
    });

    expect(quote.cashbackPercent).toBe(0.5);
    expect(quote.cashback).toBe(25);
  });
});

describe('BillsService.setPlanCashback', () => {
  it('saves the percentage on the plan row', async () => {
    const { service, editablePlan } = buildService();

    const result = await service.setPlanCashback(
      editablePlan._id.toString(),
      1.25,
    );

    expect(editablePlan.cashbackPercent).toBe(1.25);
    expect(editablePlan.save).toHaveBeenCalled();
    expect(result.cashbackPercent).toBe(1.25);
  });

  it('rejects a rate outside 0–100', async () => {
    const { service, editablePlan } = buildService();
    const id = editablePlan._id.toString();

    await expect(service.setPlanCashback(id, 101)).rejects.toThrow(
      'between 0 and 100',
    );
    await expect(service.setPlanCashback(id, -1)).rejects.toThrow(
      'between 0 and 100',
    );
    await expect(service.setPlanCashback(id, NaN)).rejects.toThrow(
      'must be a number',
    );
  });

  it('404s an unknown plan', async () => {
    const { service, servicePlanModel } = buildService();
    servicePlanModel.findById.mockResolvedValueOnce(null);

    await expect(
      service.setPlanCashback(new Types.ObjectId().toHexString(), 1),
    ).rejects.toThrow('Plan not found');
  });

  it('refuses a row left behind by a retired provider', async () => {
    // Legacy "gladtidings" rows are never served to members, so a rate saved on
    // one would silently never pay out — reject instead of pretending it worked.
    const { service, servicePlanModel, editablePlan } = buildService();
    servicePlanModel.findById.mockResolvedValueOnce({
      ...editablePlan,
      provider: 'gladtidings',
    });

    await expect(
      service.setPlanCashback(editablePlan._id.toString(), 2),
    ).rejects.toThrow('retired provider');
  });
});

describe('BillsService.listPlansAdmin', () => {
  it("only lists the active provider's plans", async () => {
    const { service, servicePlanModel } = buildService();

    await service.listPlansAdmin({ serviceType: 'data', page: 1, limit: 50 });

    expect(servicePlanModel.find).toHaveBeenCalledWith(
      expect.objectContaining({ serviceType: 'data', provider: 'vtpass' }),
    );
    expect(servicePlanModel.countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'vtpass' }),
    );
  });
});

/** A stored `BillTransaction` row as `getHistory` / `getReceipt` read it. */
function billTransactionRow() {
  return {
    _id: new Types.ObjectId(),
    user: new Types.ObjectId(USER_ID),
    type: 'data',
    status: 'success',
    amount: 100,
    reference: 'bill_1',
    externalReference: 'ext-1',
    provider: 'mtn',
    recipient: '07068497568',
    metadata: { planName: 'MTN 110MB Daily' },
    walletTransaction: new Types.ObjectId(),
    createdAt: new Date('2026-11-01T15:48:37.191Z'),
  };
}

describe('BillsService.getHistory', () => {
  it("lists the member's bills, newest first", async () => {
    const row = billTransactionRow();
    const { service, billTransactionModel } = buildService({
      billTransactionRows: [row],
    });

    const receipts = await service.getHistory(USER_ID);

    // The user id must be compared as an ObjectId — a plain string never
    // matches the ObjectId stored on the document.
    const filter = billTransactionModel.find.mock.calls[0][0] as {
      user: unknown;
    };
    expect(filter.user?.toString()).toBe(USER_ID);
    expect(receipts).toEqual([
      expect.objectContaining({
        _id: row._id.toString(),
        user: USER_ID,
        reference: 'bill_1',
        amount: 100,
        status: 'success',
        walletTransaction: row.walletTransaction.toString(),
        createdAt: row.createdAt.toISOString(),
      }),
    ]);
  });

  it('returns an empty list when the member has no bills', async () => {
    const { service } = buildService();

    await expect(service.getHistory(USER_ID)).resolves.toEqual([]);
  });

  it('filters by service type in the query, not in memory', async () => {
    const { service, billTransactionModel } = buildService({
      billTransactionRows: [billTransactionRow()],
    });

    await service.getHistory(USER_ID, { serviceType: 'data' });

    // The cap is 100 rows, so the tab must narrow the query itself — filtering
    // the already-capped list would hide a member's older data purchases.
    const filter = billTransactionModel.find.mock.calls[0][0] as {
      user: Types.ObjectId;
      type?: string;
    };
    expect(filter.user?.toString()).toBe(USER_ID);
    expect(filter.type).toBe('data');
  });

  it('omits `type` from the query when no service type is selected', async () => {
    const { service, billTransactionModel } = buildService();

    await service.getHistory(USER_ID, {});

    const filter = billTransactionModel.find.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(filter).not.toHaveProperty('type');
  });
});

describe('BillsService.getReceipt', () => {
  it("returns the member's own receipt", async () => {
    const row = billTransactionRow();
    const { service, billTransactionModel } = buildService({
      billTransactionRows: [row],
    });

    const receipt = await service.getReceipt(USER_ID, 'bill_1');

    const filter = billTransactionModel.findOne.mock.calls[0][0] as {
      user: unknown;
      reference: string;
    };
    expect(filter.user?.toString()).toBe(USER_ID);
    expect(filter.reference).toBe('bill_1');
    expect(receipt).toEqual(
      expect.objectContaining({ reference: 'bill_1', user: USER_ID }),
    );
  });

  it('404s when the reference belongs to nobody', async () => {
    const { service } = buildService();

    await expect(service.getReceipt(USER_ID, 'bill_missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});
