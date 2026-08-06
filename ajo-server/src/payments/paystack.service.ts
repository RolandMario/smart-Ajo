import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { createHmac, timingSafeEqual } from 'crypto';

interface PaystackResponse<T> {
  status: boolean;
  message: string;
  data: T;
}

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export interface VerifyTransactionResult {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paidAt?: string;
}

export interface ResolveAccountResult {
  accountNumber: string;
  accountName: string;
}

export interface TransferRecipientResult {
  recipientCode: string;
}

export interface BankListEntry {
  name: string;
  code: string;
}

export interface InitiateTransferResult {
  transferCode: string;
  status: string;
}

/**
 * Thin wrapper around the Paystack API.
 *
 * All amounts in this service's PUBLIC method signatures are in NAIRA
 * (major unit), matching `Group.contributionAmount` and `Wallet.balance`
 * elsewhere in the app. Conversion to kobo (Paystack's unit) happens at
 * the boundary, inside this service only.
 */
@Injectable()
export class PaystackService {
  private readonly logger = new Logger(PaystackService.name);
  private readonly client: AxiosInstance;
  private readonly secretKey: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
    const baseURL = this.configService.get<string>('PAYSTACK_BASE_URL')!;

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  private handleError(action: string, error: unknown): never {
    if (axios.isAxiosError(error)) {
      const message =
        (error.response?.data as { message?: string } | undefined)?.message ??
        error.message;
      this.logger.error(`Paystack ${action} failed: ${message}`);

      if (
        error.response &&
        error.response.status >= 400 &&
        error.response.status < 500
      ) {
        throw new BadRequestException(`Paystack error: ${message}`);
      }
    } else {
      this.logger.error(`Paystack ${action} failed: ${String(error)}`);
    }

    throw new InternalServerErrorException(`Paystack ${action} failed`);
  }

  /**
   * Starts a wallet funding transaction. The returned `authorizationUrl`
   * should be opened by the mobile app (e.g. in an in-app browser) for
   * the member to complete payment.
   */
  async initializeTransaction(
    email: string,
    amountNaira: number,
    reference: string,
  ): Promise<InitializeTransactionResult> {
    try {
      const response = await this.client.post<
        PaystackResponse<{
          authorization_url: string;
          access_code: string;
          reference: string;
        }>
      >('/transaction/initialize', {
        email,
        amount: Math.round(amountNaira * 100),
        reference,
      });

      const {
        authorization_url,
        access_code,
        reference: ref,
      } = response.data.data;

      return {
        authorizationUrl: authorization_url,
        accessCode: access_code,
        reference: ref,
      };
    } catch (error) {
      return this.handleError('transaction initialize', error);
    }
  }

  /**
   * Confirms the outcome of a funding transaction by reference. Used as
   * a fallback to webhooks (e.g. dev environments without a public
   * webhook URL, or if a webhook was missed).
   */
  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    try {
      const response = await this.client.get<
        PaystackResponse<{
          status: string;
          reference: string;
          amount: number;
          currency: string;
          paid_at?: string;
        }>
      >(`/transaction/verify/${encodeURIComponent(reference)}`);

      const data = response.data.data;

      return {
        status: data.status,
        reference: data.reference,
        amount: data.amount,
        currency: data.currency,
        paidAt: data.paid_at,
      };
    } catch (error) {
      return this.handleError('transaction verify', error);
    }
  }

  /**
   * Lists Nigerian banks (name + code), for populating a bank picker
   * before the member submits `POST /wallet/bank-account`.
   */
  async listBanks(): Promise<BankListEntry[]> {
    try {
      const response = await this.client.get<
        PaystackResponse<Array<{ name: string; code: string }>>
      >('/bank', {
        params: { country: 'nigeria', currency: 'NGN' },
      });

      return response.data.data.map((bank) => ({
        name: bank.name,
        code: bank.code,
      }));
    } catch (error) {
      return this.handleError('bank list', error);
    }
  }

  /**
   * Resolves an account number + bank code to the account holder's name,
   * so members can confirm the right account before saving it for
   * payouts.
   */
  async resolveAccountNumber(
    accountNumber: string,
    bankCode: string,
  ): Promise<ResolveAccountResult> {
    try {
      const response = await this.client.get<
        PaystackResponse<{ account_number: string; account_name: string }>
      >('/bank/resolve', {
        params: { account_number: accountNumber, bank_code: bankCode },
      });

      const data = response.data.data;

      return {
        accountNumber: data.account_number,
        accountName: data.account_name,
      };
    } catch (error) {
      return this.handleError('account resolution', error);
    }
  }

  /**
   * Creates a Paystack transfer recipient for a member's bank account.
   * The returned `recipientCode` is stored on the user and reused for
   * all future payouts to them.
   */
  async createTransferRecipient(params: {
    accountNumber: string;
    bankCode: string;
    accountName: string;
  }): Promise<TransferRecipientResult> {
    try {
      const response = await this.client.post<
        PaystackResponse<{ recipient_code: string }>
      >('/transferrecipient', {
        type: 'nuban',
        name: params.accountName,
        account_number: params.accountNumber,
        bank_code: params.bankCode,
        currency: 'NGN',
      });

      return { recipientCode: response.data.data.recipient_code };
    } catch (error) {
      return this.handleError('transfer recipient creation', error);
    }
  }

  /**
   * Initiates a transfer (payout) to a previously-created recipient.
   * `status` may be 'success' (completed synchronously), 'pending' or
   * 'otp' (requires webhook confirmation / OTP finalization), or
   * 'failed'.
   */
  async initiateTransfer(params: {
    amountNaira: number;
    recipientCode: string;
    reason: string;
    reference: string;
  }): Promise<InitiateTransferResult> {
    try {
      const response = await this.client.post<
        PaystackResponse<{ transfer_code: string; status: string }>
      >('/transfer', {
        source: 'balance',
        amount: Math.round(params.amountNaira * 100),
        recipient: params.recipientCode,
        reason: params.reason,
        reference: params.reference,
      });

      return {
        transferCode: response.data.data.transfer_code,
        status: response.data.data.status,
      };
    } catch (error) {
      return this.handleError('transfer initiation', error);
    }
  }

  /**
   * Returns `true` when the configured secret key starts with `sk_test_`,
   * indicating we are running against the Paystack test environment.
   * In test mode, transfers return `status: 'otp'` and require an OTP
   * to be resolved before they complete.
   */
  isTestMode(): boolean {
    return this.secretKey.startsWith('sk_test_');
  }

  /**
   * Resolves an OTP for a pending transfer. In test mode the OTP is
   * always `123456`. In live mode this would be the OTP sent to the
   * recipient's phone.
   *
   * Uses `/transfer/finalize_transfer` (the current Paystack endpoint;
   * the older `/transfer/resolve_otp` was deprecated and returns 404).
   */
  async resolveOtp(
    transferCode: string,
    otp: string,
  ): Promise<{ status: string }> {
    try {
      const response = await this.client.post<
        PaystackResponse<{ status: string }>
      >('/transfer/finalize_transfer', {
        transfer_code: transferCode,
        otp,
      });

      return { status: response.data.data.status };
    } catch (error) {
      return this.handleError('transfer OTP resolution', error);
    }
  }

  /**
   * Verifies the `x-paystack-signature` header on an incoming webhook
   * using a constant-time comparison. `rawBody` MUST be the raw,
   * unparsed request body bytes — signature verification fails against
   * a re-serialized JSON body.
   */
  verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
  ): boolean {
    if (!signatureHeader) {
      return false;
    }

    const expected = createHmac('sha512', this.secretKey)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const actualBuffer = Buffer.from(signatureHeader, 'utf8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
