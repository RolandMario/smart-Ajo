import axios from 'axios';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { VTPassService } from './vtpass.service';

/**
 * Regression tests for the bills provider after Gladtidings was removed.
 *
 * Every case here maps to a production failure mode seen with live VTpass:
 *  - `087 INVALID CREDENTIALS` surfacing as a generic 400 on bill purchase,
 *  - a purchase reported as failed while VTpass had actually delivered it,
 *  - `merchant-verify` answering `code: "000"` for an unknown smartcard,
 *  - cable vends rejected because no bouquet (`variation_code`) was sent.
 */

jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return {
    ...actual,
    create: jest.fn(),
  };
});

// eslint-disable-next-line @typescript-eslint/unbound-method -- axios.create is replaced by the jest mock above.
const createMock = axios.create as jest.Mock;

/** Arguments of a VTpass POST: the path and its JSON payload. */
type PostArgs = [string, Record<string, unknown>];

let post!: jest.Mock<Promise<unknown>, PostArgs>;
let get!: jest.Mock;

beforeEach(() => {
  post = jest.fn<Promise<unknown>, PostArgs>();
  get = jest.fn();
  createMock.mockReturnValue({ post, get });
  createMock.mockClear();
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function buildService(
  overrides: Record<string, string | undefined> = {},
): VTPassService {
  const values: Record<string, string | undefined> = {
    VTPASS_API_KEY: 'api-key-123',
    VTPASS_PUBLIC_KEY: 'PK_test_public',
    VTPASS_SECRET_KEY: 'SK_test_secret',
    VTPASS_BASE_URL: 'https://vtpass.com/api/',
    ...overrides,
  };
  const configService = {
    get: jest.fn((key: string) => values[key]),
  } as never;

  return new VTPassService(configService);
}

/** A clean VTpass success payload for /pay. */
function paySuccess(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      code: '000',
      response_description: '000',
      content: {
        transactions: {
          status: 'delivered',
          transactionId: '1234567890',
          commission: 12.5,
          ...overrides,
        },
      },
    },
  };
}

/** A failure payload; VTpass routinely sends code 016 for transient failures. */
function payFailure(code: string, description: string) {
  return {
    data: {
      code,
      response_description: description,
      content: { transactions: { status: 'failed' } },
    },
  };
}

describe('VTPassService configuration guards', () => {
  it('reports which keys are missing instead of calling VTpass', async () => {
    const service = buildService({
      VTPASS_API_KEY: undefined,
      VTPASS_SECRET_KEY: '   ',
    });

    expect(service.isConfigured()).toBe(false);
    expect(service.missingConfig()).toEqual([
      'VTPASS_API_KEY',
      'VTPASS_SECRET_KEY',
    ]);

    await expect(
      service.purchaseAirtime({ serviceID: 'mtn', phone: '0803', amount: 500 }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(post).not.toHaveBeenCalled();

    await expect(
      service.verifyProduct({ serviceID: 'dstv', billersCode: '1234' }),
    ).rejects.toThrow(/VTPASS_API_KEY/);
  });

  it('is configured when the whole key pair is present', () => {
    const service = buildService();

    expect(service.isConfigured()).toBe(true);
    expect(service.missingConfig()).toEqual([]);
  });
});

describe('VTPassService.purchaseAirtime', () => {
  it('accepts the numeric 0 success code and returns commission + id', async () => {
    post.mockResolvedValueOnce(paySuccess({ commission: 20 }));
    const service = buildService();

    const result = await service.purchaseAirtime({
      serviceID: 'mtn',
      phone: '08031234567',
      amount: 500,
    });

    expect(result.externalTransactionId).toBe('1234567890');
    expect(result.commission).toBe(20);
    expect(result.status).toBe('delivered');
  });

  it('sends a 12-digit timestamp request_id with a unique suffix', async () => {
    post.mockResolvedValueOnce(paySuccess());
    const service = buildService();

    await service.purchaseAirtime({
      serviceID: 'mtn',
      phone: '08031234567',
      amount: 500,
    });

    const payload = post.mock.calls[0][1] as { request_id: string };
    expect(payload.request_id).toMatch(/^\d{12}[a-f0-9]{12}$/);
  });

  it('rejects amounts below the VTpass ₦50 floor before calling the API', async () => {
    const service = buildService();

    await expect(
      service.purchaseAirtime({ serviceID: 'mtn', phone: '0803', amount: 20 }),
    ).rejects.toThrow('Airtime purchases start at ₦50');
    expect(post).not.toHaveBeenCalled();
  });

  it('requeries before failing a vend (code 016 can still be delivered)', async () => {
    post
      .mockResolvedValueOnce(payFailure('016', 'TRANSACTION FAILED'))
      .mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            transactions: {
              status: 'delivered',
              transactionId: '999',
              commission: 7,
            },
          },
        },
      });
    const service = buildService();

    const result = await service.purchaseAirtime({
      serviceID: 'mtn',
      phone: '08031234567',
      amount: 500,
    });

    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][0]).toBe('requery');
    expect(result.externalTransactionId).toBe('999');
  });

  it('maps an unconfirmed 016 to 503 so the member retries instead of a 400', async () => {
    post
      .mockResolvedValueOnce(payFailure('016', 'TRANSACTION FAILED'))
      .mockResolvedValueOnce(payFailure('016', 'TRANSACTION FAILED'));
    const service = buildService();

    await expect(
      service.purchaseAirtime({
        serviceID: 'mtn',
        phone: '08031234567',
        amount: 500,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('surfaces 087 INVALID CREDENTIALS as 503 naming the env vars', async () => {
    post
      .mockResolvedValueOnce(payFailure('087', 'INVALID CREDENTIALS'))
      .mockResolvedValueOnce(payFailure('087', 'INVALID CREDENTIALS'));
    const service = buildService();

    await expect(
      service.purchaseAirtime({
        serviceID: 'mtn',
        phone: '08031234567',
        amount: 500,
      }),
    ).rejects.toThrow(/VTPASS_API_KEY/);
  });

  it('treats an HTTP error as a success when the requery confirms delivery', async () => {
    post.mockRejectedValueOnce(
      Object.assign(new Error('timeout of 60000ms exceeded'), {
        isAxiosError: true,
      }),
    );
    post.mockResolvedValueOnce({
      data: {
        code: '000',
        content: {
          transactions: { status: 'delivered', transactionId: '777' },
        },
      },
    });
    const service = buildService();

    const result = await service.purchaseAirtime({
      serviceID: 'mtn',
      phone: '08031234567',
      amount: 500,
    });

    expect(result.externalTransactionId).toBe('777');
  });
});

describe('VTPassService.verifyProduct', () => {
  it('rejects a smartcard flagged with WrongBillersCode despite code 000', async () => {
    post.mockResolvedValueOnce({
      data: {
        code: '000',
        response_description: '000',
        content: {
          error: 'WRONG BILLERS CODE',
          WrongBillersCode: true,
          transactions: {},
        },
      },
    });
    const service = buildService();

    const result = await service.verifyProduct({
      serviceID: 'dstv',
      billersCode: '0000000000',
    });

    expect(result.valid).toBe(false);
    expect(result.message).toBe('WRONG BILLERS CODE');
  });

  it('returns the customer name and package for a valid smartcard', async () => {
    post.mockResolvedValueOnce({
      data: {
        code: '000',
        response_description: '000',
        content: {
          customer_name: 'JANE DOE',
          product_name: 'DStv Compact',
          transactions: {},
        },
      },
    });
    const service = buildService();

    const result = await service.verifyProduct({
      serviceID: 'dstv',
      billersCode: '1234567890',
    });

    expect(result).toMatchObject({
      valid: true,
      name: 'JANE DOE',
      packageInfo: 'DStv Compact',
    });
  });

  // Live cable verification answers in PascalCase — reading only snake_case
  // reported every valid smartcard as "Customer details could not be found".
  it('reads the PascalCase fields the live cable response returns', async () => {
    post.mockResolvedValueOnce({
      data: {
        code: '000',
        content: {
          Customer_Name: 'TEST METER',
          Status: 'ACTIVE',
          Due_Date: '2025-02-06T00:00:00',
          Customer_Number: '8061522780',
          Customer_Type: 'DSTV',
          Current_Bouquet: 'DStv Compact',
          Renewal_Amount: '19000.00',
          commission_details: { amount: null, rate: '1.50' },
        },
      },
    });
    const service = buildService();

    const result = await service.verifyProduct({
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

  it('still reads a snake_case meter response nested in transactions', async () => {
    post.mockResolvedValueOnce({
      data: {
        code: '000',
        content: {
          transactions: {
            customer_name: 'JOHN DOE',
            customer_address: '12 Marina Road',
          },
        },
      },
    });
    const service = buildService();

    const result = await service.verifyProduct({
      serviceID: 'ikeja-electric',
      billersCode: '04123456789',
    });

    expect(result).toMatchObject({
      valid: true,
      name: 'JOHN DOE',
      address: '12 Marina Road',
    });
  });

  describe('VTPassService.purchaseCable', () => {
    it('requires a bouquet code and sends subscription_type=renew', async () => {
      const service = buildService();

      await expect(
        service.purchaseCable({
          serviceID: 'dstv',
          billersCode: '1234567890',
          amount: 19000,
          phone: '08031234567',
          variationCode: '',
        }),
      ).rejects.toThrow('A cable/bouquet plan must be selected');

      post.mockResolvedValueOnce(paySuccess());
      await service.purchaseCable({
        serviceID: 'dstv',
        billersCode: '1234567890',
        amount: 19000,
        phone: '08031234567',
        variationCode: 'dstv-compact',
      });

      const payload = post.mock.calls[0][1];
      expect(payload.variation_code).toBe('dstv-compact');
      expect(payload.subscription_type).toBe('renew');
      expect(payload.amount).toBe(19000);
    });

    it('renews the current bouquet by amount alone, with no variation_code', async () => {
      const service = buildService();
      post.mockResolvedValueOnce(paySuccess());

      await service.purchaseCable({
        serviceID: 'dstv',
        billersCode: '1234567890',
        amount: 19000,
        phone: '08031234567',
        renewCurrentBouquet: true,
      });

      const payload = post.mock.calls[0][1];
      expect(payload.variation_code).toBeUndefined();
      expect(payload.subscription_type).toBe('renew');
      expect(payload.amount).toBe(19000);
    });
  });

  describe('VTPassService.purchaseElectricity', () => {
    it('verifies the meter before vending and returns the token', async () => {
      post.mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            customer_name: 'JANE DOE',
            address: '12 Marina',
            transactions: {},
          },
        },
      });
      post.mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            transactions: {
              status: 'delivered',
              transactionId: '555',
              token: '1234-5678-9012',
              units: '45.2',
              disco_name: 'Ikeja Electric',
            },
          },
        },
      });
      const service = buildService();

      const result = await service.purchaseElectricity({
        serviceID: 'ikeja-electric',
        billersCode: '04123456789',
        amount: 5000,
        phone: '08031234567',
        variationCode: 'prepaid',
      });

      expect(post.mock.calls[0][0]).toBe('merchant-verify');
      expect(post.mock.calls[1][0]).toBe('pay');
      expect(result.providerData).toMatchObject({
        token: '1234-5678-9012',
        units: '45.2',
        discoName: 'Ikeja Electric',
        customerName: 'JANE DOE',
      });
    });

    /**
     * Live IKEDC vends put the recharge details at the top level of the body —
     * `token`, `units`, `tokenAmount` — beside `content`, not inside it, and
     * label the token (`"Token : 2636…"`) and the unit (`"79.9 kWh"`). Reading
     * only `content` is why receipts showed neither, so this payload is the
     * documented live shape (vtpass.com/documentation/ikedc-ikeja-electric).
     */
    it('reads the token and units VTpass returns at the top level of the body', async () => {
      post.mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            Customer_Name: 'AKIN SHOKUNBI A',
            WrongBillersCode: false,
          },
        },
      });
      post.mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            transactions: {
              status: 'delivered',
              product_name: 'Ikeja Electric Payment',
              transactionId: '17935526353609897803475034',
              commission: 15,
            },
          },
          response_description: 'TRANSACTION SUCCESSFUL',
          requestId: '20251101170400abcdef123456',
          purchased_code: 'Token : 26362054405982757802',
          customerName: 'N/A',
          customerAddress: 'N/A',
          token: 'Token : 26362054405982757802',
          tokenAmount: 1860.47,
          units: '79.9 kWh',
          tariff: 'R2 SINGLE PHASE RESIDENTIAL',
          exchangeReference: '40532461',
        },
      });
      const service = buildService();

      const result = await service.purchaseElectricity({
        serviceID: 'ikeja-electric',
        billersCode: '04290595364',
        amount: 2000,
        phone: '07068497568',
        variationCode: 'prepaid',
      });

      expect(result.providerData).toMatchObject({
        token: '26362054405982757802',
        units: '79.9',
        packageName: 'Ikeja Electric Payment',
        customerName: 'AKIN SHOKUNBI A',
      });
      // "N/A" is VTpass filler, not a customer name — and the vend succeeded, so
      // no requery was needed.
      expect(post.mock.calls.map((call) => call[0])).toEqual([
        'merchant-verify',
        'pay',
      ]);
    });

    it('requeries a prepaid vend that lands without a token', async () => {
      post.mockResolvedValueOnce({
        data: { code: '000', content: { customer_name: 'JANE DOE' } },
      });
      // Vend acknowledged, token not generated yet.
      post.mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            transactions: { status: 'delivered', transactionId: '555' },
          },
          response_description: 'TRANSACTION SUCCESSFUL',
          purchased_code: '',
          token: 'Token : N/A',
          units: 'N/A',
        },
      });
      // Requery a moment later has it.
      post.mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            transactions: {
              status: 'delivered',
              transactionId: '555',
              extras: 'Token : 26362054405982757802',
            },
          },
          token: 'Token : 26362054405982757802',
          units: '79.9 kWh',
        },
      });
      const service = buildService();

      const result = await service.purchaseElectricity({
        serviceID: 'ikeja-electric',
        billersCode: '04290595364',
        amount: 2000,
        phone: '07068497568',
        variationCode: 'prepaid',
      });

      expect(result.providerData).toMatchObject({
        token: '26362054405982757802',
        units: '79.9',
        customerName: 'JANE DOE',
      });
      const requery = post.mock.calls[2];
      expect(requery[0]).toBe('requery');
      // The requery must reuse the vend's own request_id — that is the only key
      // VTpass accepts for it.
      expect(requery[1].request_id).toBe(post.mock.calls[1][1].request_id);
    });

    it('refuses to vend to a meter that does not verify', async () => {
      post.mockResolvedValueOnce({
        data: {
          code: '000',
          content: { error: 'INVALID METER NUMBER', WrongBillersCode: true },
        },
      });
      const service = buildService();

      await expect(
        service.purchaseElectricity({
          serviceID: 'ikeja-electric',
          billersCode: '000',
          amount: 5000,
          phone: '08031234567',
          variationCode: 'prepaid',
        }),
      ).rejects.toThrow('INVALID METER NUMBER');
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('enforces the ₦500 minimum before touching VTpass', async () => {
      const service = buildService();

      await expect(
        service.purchaseElectricity({
          serviceID: 'ikeja-electric',
          billersCode: '04123456789',
          amount: 100,
          phone: '08031234567',
          variationCode: 'prepaid',
        }),
      ).rejects.toThrow('Electricity payments start at ₦500');
      expect(post).not.toHaveBeenCalled();
    });
  });

  describe('VTPassService.getServiceVariations', () => {
    it('maps variations, treating fixedPrice "Yes" as fixed', async () => {
      get.mockResolvedValueOnce({
        data: {
          code: '000',
          content: {
            variations: [
              {
                variation_code: 'dstv-compact',
                name: 'DStv Compact',
                variation_amount: '19000',
                fixedPrice: 'Yes',
              },
            ],
          },
        },
      });
      const service = buildService();

      await expect(service.getServiceVariations('dstv')).resolves.toEqual([
        {
          variationCode: 'dstv-compact',
          name: 'DStv Compact',
          amount: 19000,
          fixedPrice: true,
        },
      ]);
    });
  });
});
