import axios from 'axios';
import { PaystackService } from './paystack.service';

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

function buildService(preferredBank = 'wema') {
  const configService = {
    get: jest.fn((key: string) => {
      switch (key) {
        case 'PAYSTACK_SECRET_KEY':
          return 'sk_test_secret';
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
  createMock.mockReturnValue({ post, get: jest.fn() } as never);
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
      .mockRejectedValueOnce(paystackError('wema is not available in test mode'))
      .mockRejectedValueOnce(paystackError('providus is not available in test mode'))
      .mockRejectedValueOnce(paystackError('sterling is not available in test mode'))
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