import axios from 'axios';
import {
  PaystackService,
  PAYSTACK_NOT_CONFIGURED_MESSAGE,
} from './paystack.service';

/**
 * Focused unit tests for Dedicated Virtual Account (DVA) bank selection:
 * the automatic fallback when Paystack rejects the preferred bank in the
 * current mode (e.g. `wema is not available in test mode` — Wema is
 * live-only).
 */

jest.mock('axios', () => {
  const actual = jest.requireActual('axios');
  return {
    ...actual,
    create: jest.fn(),
  };
});

const createMock = axios.create as jest.Mock;

const VALID_TEST_KEY = 'sk_test_0123456789abcdef0123456789abcdef';
const VALID_LIVE_KEY = 'sk_live_your-paystack-secret-key';

function buildService(
  preferredBank = 'wema-bank',
  secretKey: string | null = VALID_TEST_KEY,
) {
  const configService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'PAYSTACK_SECRET_KEY':
          return secretKey ?? undefined;
        case 'PAYSTACK_BASE_URL':
          return 'https://api.paystack.co';
        case 'PAYSTACK_DVA_PREFERRED_BANK':
          return preferredBank;
        default:
          return undefined;
      }
    }),
  } as never;

  return new PaystackService(configService);
}

/**
 * A successful Paystack POST /dedicated_account response.
 *
 * LIVE PAYSTACK RETURNS THE ACCOUNT FLAT UNDER `data` — there is no
 * `dedicated_account` wrapper. Parsing the wrapper (as this code used to)
 * produced an empty account number and stored an unusable DVA.
 */
function dvaResponse(accountNumber: string, bankName: string) {
  return {
    data: {
      status: true,
      message: 'Dedicated account successfully assigned',
      data: {
        id: 9989123,
        account_name: 'JANE DOE',
        account_number: accountNumber,
        bank: { name: bankName, slug: 'wema-bank' },
        active: true,
        assigned: true,
        currency: 'NGN',
      },
    },
  };
}

/** GET /dedicated_account/available_providers — live businesses list slugs. */
function providersResponse(slugs: string[]) {
  return {
    data: {
      status: true,
      message: 'Providers retrieved',
      data: slugs.map((slug, index) => ({
        id: index + 1,
        provider_slug: slug,
        bank_name: slug,
      })),
    },
  };
}

/** GET /dedicated_account — a FLAT array of accounts. */
function dvaListResponse(
  accounts: Array<{
    accountNumber: string;
    bankName: string;
    active?: boolean;
  }>,
) {
  return {
    data: {
      status: true,
      message: 'Dedicated accounts retrieved',
      data: accounts.map((account, index) => ({
        id: 9000 + index,
        account_name: 'JANE DOE',
        account_number: account.accountNumber,
        bank: { name: account.bankName },
        active: account.active ?? true,
        assigned: true,
        currency: 'NGN',
      })),
    },
  };
}

/** An Axios-shaped error carrying Paystack's `message`. */
function paystackError(message: string, status = 400) {
  const error = new Error(message);
  (error as unknown as Record<string, unknown>).isAxiosError = true;
  (error as unknown as Record<string, unknown>).response = {
    status,
    data: { message },
  };
  return error;
}

let post!: jest.Mock;
let get!: jest.Mock;
let del!: jest.Mock;

beforeEach(() => {
  post = jest.fn();
  // Default: the business advertises no DVA providers, so ordering falls back
  // to the static pool. Individual tests override with providersResponse().
  get = jest.fn().mockResolvedValue(providersResponse([]));
  del = jest.fn().mockResolvedValue({ data: { status: true, data: null } });
  createMock.mockReturnValue({ post, get, delete: del });
  createMock.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const baseParams = {
  customerCode: 'CUS_xyz',
  preferredBank: 'wema-bank',
  phone: '+2348012345678',
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('PaystackService.dvaBankCandidates', () => {
  it('orders candidates with the configured bank first, then the pool', () => {
    const service = buildService('sterling');

    expect(service.dvaBankCandidates()).toEqual([
      'sterling',
      'wema-bank',
      'titan-paystack',
      'wema',
      'providus',
    ]);
  });

  it('defaults to the live wema-bank slug, not the invalid "wema" string', () => {
    const service = buildService();

    expect(service.dvaPreferredBank()).toBe('wema-bank');
    expect(service.dvaBankCandidates()[0]).toBe('wema-bank');
  });

  it('puts the providers Paystack reports for this business right after the preferred bank', () => {
    const service = buildService('providus');

    expect(service.dvaBankCandidates(['wema-bank', 'titan-paystack'])).toEqual([
      'providus',
      'wema-bank',
      'titan-paystack',
      'wema',
      'sterling',
    ]);
  });
});

describe('PaystackService.createDedicatedAccount', () => {
  it('parses the FLAT live response and requests the preferred provider slug', async () => {
    post.mockResolvedValueOnce(dvaResponse('9817686278', 'Wema Bank'));
    const service = buildService('wema-bank');

    const result = await service.createDedicatedAccount(baseParams);

    expect(result).toEqual({
      accountId: '9989123',
      accountNumber: '9817686278',
      accountName: 'JANE DOE',
      bankName: 'Wema Bank',
      currency: 'NGN',
      active: true,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      customer: 'CUS_xyz',
      preferred_bank: 'wema-bank',
      phone: '+2348012345678',
    });
  });

  it('still parses legacy responses that wrap the account in `dedicated_account`', async () => {
    post.mockResolvedValueOnce({
      data: {
        status: true,
        data: {
          dedicated_account: {
            id: 42,
            account_number: '5900000001',
            account_name: 'JANE DOE',
            bank: { name: 'Wema Bank' },
            active: true,
            currency: 'NGN',
          },
        },
      },
    });
    const service = buildService('wema-bank');

    const result = await service.createDedicatedAccount(baseParams);

    expect(result.accountNumber).toBe('5900000001');
    expect(result.accountId).toBe('42');
  });

  it('prefers the providers the business actually offers when the preferred bank is rejected', async () => {
    get.mockResolvedValueOnce(
      providersResponse(['wema-bank', 'titan-paystack']),
    );
    post
      .mockRejectedValueOnce(paystackError('Invalid bank'))
      .mockResolvedValueOnce(dvaResponse('9817686278', 'Wema Bank'));
    const service = buildService('sterling');

    const result = await service.createDedicatedAccount({
      ...baseParams,
      preferredBank: 'sterling',
    });

    expect(result.accountNumber).toBe('9817686278');
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1]).toMatchObject({ preferred_bank: 'sterling' });
    expect(post.mock.calls[1][1]).toMatchObject({
      preferred_bank: 'wema-bank',
    });
  });

  it('falls back to the next bank when the preferred one is unavailable in test mode', async () => {
    post
      .mockRejectedValueOnce(
        paystackError('wema-bank is not available in test mode'),
      )
      .mockResolvedValueOnce(dvaResponse('9200001234', 'Sterling Bank'));
    const service = buildService('wema-bank');

    const result = await service.createDedicatedAccount(baseParams);

    expect(result.accountNumber).toBe('9200001234');
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toMatchObject({
      preferred_bank: 'titan-paystack',
    });
  });

  it('surfaces non-bank DVA failures immediately without trying other banks', async () => {
    post.mockRejectedValueOnce(
      paystackError(
        'Dedicated virtual account is not enabled for this business',
      ),
    );
    const service = buildService('wema-bank');

    await expect(service.createDedicatedAccount(baseParams)).rejects.toThrow(
      'Dedicated virtual account is not enabled for this business',
    );

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('rethrows the last bank-availability error when every candidate is rejected', async () => {
    post
      .mockRejectedValueOnce(paystackError('Invalid bank'))
      .mockRejectedValueOnce(paystackError('Invalid bank'))
      .mockRejectedValueOnce(paystackError('Invalid bank'))
      .mockRejectedValueOnce(paystackError('Invalid bank'))
      .mockRejectedValueOnce(paystackError('sterling is not available'));

    const service = buildService('wema-bank');

    await expect(service.createDedicatedAccount(baseParams)).rejects.toThrow(
      'sterling is not available',
    );
    expect(post).toHaveBeenCalledTimes(5);
  });
});

describe('PaystackService.fetchDedicatedAccounts', () => {
  it('filters by `customer` (not the ignored `customer_code`) and reads flat entries', async () => {
    get.mockResolvedValueOnce(
      dvaListResponse([
        { accountNumber: '9817686278', bankName: 'Wema Bank' },
        { accountNumber: '', bankName: 'Unassigned', active: false },
      ]),
    );
    const service = buildService();

    const accounts = await service.fetchDedicatedAccounts('CUS_abc');

    expect(accounts).toEqual([
      {
        accountId: '9000',
        accountNumber: '9817686278',
        accountName: 'JANE DOE',
        bankName: 'Wema Bank',
        currency: 'NGN',
        active: true,
      },
    ]);
    expect(get).toHaveBeenCalledWith('/dedicated_account', {
      params: { customer: 'CUS_abc' },
    });
  });
});

describe('PaystackService.deactivateDedicatedAccount', () => {
  it('uses DELETE /dedicated_account/:id', async () => {
    const service = buildService();

    await service.deactivateDedicatedAccount('9989123');

    expect(del).toHaveBeenCalledWith('/dedicated_account/9989123');
  });
});

describe('PaystackService.keyMode', () => {
  it('reports the mode the current key belongs to', () => {
    expect(buildService('wema-bank', VALID_TEST_KEY).keyMode()).toBe('test');
    expect(buildService('wema-bank', VALID_LIVE_KEY).keyMode()).toBe('live');
  });

  it('treats a missing key as live (assertConfigured is the real guard)', () => {
    expect(buildService('wema-bank', null).keyMode()).toBe('live');
  });
});

describe('PaystackService customer error discriminators', () => {
  it('recognises the mode-mismatch "Customer not found" answer', () => {
    const service = buildService();

    expect(
      service.isCustomerNotFoundError(paystackError('Customer not found', 404)),
    ).toBe(true);
    expect(
      service.isCustomerNotFoundError(paystackError('Invalid key', 401)),
    ).toBe(false);
  });

  it('recognises duplicate-email customer failures', () => {
    const service = buildService();

    expect(
      service.isDuplicateCustomerError(
        paystackError('Customer already exists for this email'),
      ),
    ).toBe(true);
    expect(
      service.isDuplicateCustomerError(paystackError('Invalid key', 401)),
    ).toBe(false);
  });
});

/**
 * Regression guard for "Paystack error: Invalid key" reaching the admin's
 * payout screen. The server had been booting with a committed (revoked) test
 * key, so every payment call 401'd and the raw gateway message was shown as if
 * the payout logic were broken. These lock in the fail-fast behaviour.
 */
describe('PaystackService configuration guards', () => {
  const transferParams = {
    amountNaira: 1200,
    recipientCode: 'RCP_test',
    reason: 'Ajo payout',
    reference: 'payout_test_1',
  };

  it('accepts a real-looking secret key, trimming quotes and whitespace', () => {
    const service = buildService('wema', `  "${VALID_TEST_KEY}"\n`);

    expect(service.isConfigured()).toBe(true);
    expect(() => service.assertConfigured()).not.toThrow();
  });

  it('treats a missing key as unconfigured and refuses transfers', async () => {
    const service = buildService('wema', null);

    expect(service.isConfigured()).toBe(false);
    expect(service.isTestMode()).toBe(false);
    expect(() => service.assertConfigured()).toThrow(
      PAYSTACK_NOT_CONFIGURED_MESSAGE,
    );

    await expect(service.initiateTransfer(transferParams)).rejects.toThrow(
      PAYSTACK_NOT_CONFIGURED_MESSAGE,
    );
    // No HTTP call is attempted with `Bearer undefined`.
    expect(post).not.toHaveBeenCalled();
  });

  it('treats placeholder keys as unconfigured', () => {
    for (const key of [
      'sk_test_your-paystack-secret-key',
      'sk_test_placeholder',
      'pk_test_0123456789abcdef0123456789abcdef',
      'sk_test_short',
    ]) {
      expect(buildService('wema', key).isConfigured()).toBe(false);
    }
  });

  it('maps a 401 "Invalid key" response to the configuration message', async () => {
    post.mockRejectedValueOnce(paystackError('Invalid key', 401));
    const service = buildService();

    await expect(service.initiateTransfer(transferParams)).rejects.toThrow(
      PAYSTACK_NOT_CONFIGURED_MESSAGE,
    );
  });

  it('still reports ordinary 4xx transfer failures as Paystack errors', async () => {
    post.mockRejectedValueOnce(
      paystackError('Transfer limit exceeded for this account', 400),
    );
    const service = buildService();

    await expect(service.initiateTransfer(transferParams)).rejects.toThrow(
      'Paystack error: Transfer limit exceeded for this account',
    );
  });
});
