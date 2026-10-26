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

function buildService(
  preferredBank = 'wema',
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

/** A successful Paystack /dedicated_account creation response. */
function dvaResponse(accountNumber: string, bankName: string) {
  return {
    data: {
      status: true,
      message: 'success',
      data: {
        dedicated_account: {
          id: 9989123,
          account_name: 'Jane Doe/9989123',
          account_number: accountNumber,
          bank: { name: bankName },
          active: true,
          assigned: true,
          currency: 'NGN',
        },
      },
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

beforeEach(() => {
  post = jest.fn();
  createMock.mockReturnValue({ post, get: jest.fn() });
  createMock.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

const baseParams = {
  customerCode: 'CUS_xyz',
  preferredBank: 'wema',
  phone: '+2348012345678',
  firstName: 'Jane',
  lastName: 'Doe',
};

describe('PaystackService.getDedicatedAccountParams', () => {
  it('orders candidates with the configured bank first and no duplicates', () => {
    const service = buildService('sterling');

    expect(service.dvaBankCandidates()).toEqual([
      'sterling',
      'wema',
      'providus',
      'titan-paystack',
    ]);
  });

  it('defaults to wema as the first candidate when unconfigured', () => {
    const service = buildService('wema');

    expect(service.dvaBankCandidates()[0]).toBe('wema');
    expect(service.dvaBankCandidates()).toHaveLength(4);
  });
});

describe('PaystackService.createDedicatedAccount', () => {
  it('succeeds immediately with the preferred bank when available', async () => {
    post.mockResolvedValueOnce(dvaResponse('5900000001', 'Wema Bank'));
    const service = buildService('wema');

    const result = await service.createDedicatedAccount(baseParams);

    expect(result.accountNumber).toBe('5900000001');
    expect(result.bankName).toBe('Wema Bank');
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({ preferred_bank: 'wema' });
  });

  it('falls back to a supported bank when the preferred one is rejected in test mode', async () => {
    post
      .mockRejectedValueOnce(
        paystackError('wema is not available in test mode'),
      )
      .mockResolvedValueOnce(dvaResponse('9200001234', 'Sterling Bank'));
    const service = buildService('wema');

    const result = await service.createDedicatedAccount(baseParams);

    expect(result.accountNumber).toBe('9200001234');
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[0][1]).toMatchObject({ preferred_bank: 'wema' });
    expect(post.mock.calls[1][1]).toMatchObject({
      preferred_bank: 'providus',
    });
  });

  it('surfaces non-bank DVA failures immediately without trying other banks', async () => {
    post.mockRejectedValueOnce(
      paystackError(
        'Dedicated virtual account is not enabled for this business',
      ),
    );
    const service = buildService('wema');

    await expect(service.createDedicatedAccount(baseParams)).rejects.toThrow(
      'Dedicated virtual account is not enabled for this business',
    );

    expect(post).toHaveBeenCalledTimes(1);
  });

  it('rethrows the last bank-availability error when every candidate is rejected', async () => {
    post
      .mockRejectedValueOnce(
        paystackError('wema is not available in test mode'),
      )
      .mockRejectedValueOnce(
        paystackError('providus is not available in test mode'),
      )
      .mockRejectedValueOnce(
        paystackError('sterling is not available in test mode'),
      )
      .mockRejectedValueOnce(
        paystackError('titan-paystack is not available in test mode'),
      );

    const service = buildService('wema');

    await expect(service.createDedicatedAccount(baseParams)).rejects.toThrow(
      'titan-paystack is not available in test mode',
    );
    expect(post).toHaveBeenCalledTimes(4);
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
