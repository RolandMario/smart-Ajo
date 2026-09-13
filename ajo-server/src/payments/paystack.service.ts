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

export interface CreateCustomerResult {
  customerCode: string;
}

export interface DedicatedAccountResult {
  /** Paystack's numeric id for the DVA, when the API returns one. */
  accountId?: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  currency: string;
  active: boolean;
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

  /**
   * Paystack DVA issuing banks (Nigeria). Only Wema, Providus and Sterling
   * are supported in live mode; in test mode Paystack accepts Providus and
   * Sterling (Wema is live-only and returns an error such as
   * `wema is not available in test mode`). `titan-paystack` is reserved for
   * Titan Paystack live accounts.
   */
  private readonly DVA_BANK_POOL = [
    'wema',
    'providus',
    'sterling',
    'titan-paystack',
  ] as const;

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
   * Creates a Paystack customer for a member. The returned `customerCode`
   * (CUS_xxx) must exist before a Dedicated Virtual Account can be
   * requested. `POST /customer` always creates a NEW customer — callers
   * must persist the code and reuse it rather than re-creating.
   */
  async createCustomer(params: {
    firstName?: string;
    lastName?: string;
    phone: string;
    email?: string;
  }): Promise<CreateCustomerResult> {
    try {
      const body: Record<string, string> = { phone: params.phone };
      if (params.email) body.email = params.email;
      if (params.firstName) body.first_name = params.firstName;
      if (params.lastName) body.last_name = params.lastName;

      const response = await this.client.post<
        PaystackResponse<{ customer_code: string }>
      >('/customer', body);

      return { customerCode: response.data.data.customer_code };
    } catch (error) {
      return this.handleError('customer creation', error);
    }
  }

  /**
   * The preferred bank to request Dedicated Virtual Accounts from
   * (`PAYSTACK_DVA_PREFERRED_BANK` — Nigeria options: `wema`, `providus`,
   * `sterling`; `titan-paystack` for Titan live accounts). This is the FIRST
   * bank attempted; `createDedicatedAccount` transparently falls back through
   * the remaining pool when Paystack rejects the preferred bank in the
   * current mode (e.g. Wema in test mode).
   */
  dvaPreferredBank(): string {
    return (
      this.configService.get<string>('PAYSTACK_DVA_PREFERRED_BANK') ?? 'wema'
    );
  }

  /**
   * Ordered DVA bank candidates: the configured preferred bank first, then
   * the rest of the supported pool. Deduplicated so a configured value that
   * matches the pool isn't tried twice.
   */
  dvaBankCandidates(): string[] {
    const preferred = this.dvaPreferredBank().trim().toLowerCase();
    return [preferred, ...this.DVA_BANK_POOL.filter((bank) => bank !== preferred)];
  }

  /**
   * Whether an error means "this bank can't issue DVAs in the current
   * mode" rather than a general DVA failure. Paystack test mode returns
   * e.g. `wema is not available in test mode` (Wema is live-only); such
   * errors are safe to skip in favour of the next candidate bank.
   */
  private isDvaBankUnavailableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return /is not available in test mode|bank is not (?:available|supported)/i.test(
      message,
    );
  }

  /**
   * Requests a Dedicated Virtual Account (DVA) for an existing customer.
   * Paystack assigns the account number (its prefix depends on the
   * preferred bank, e.g. `5900...` for Wema) — the member's phone is
   * attached to the assignment and used to reconcile inbound transfers.
   *
   * The bank is tried in order from `dvaBankCandidates()`; if Paystack
   * reports the bank is unavailable in the current mode (e.g. Wema in test
   * mode), the next candidate is attempted automatically.
   */
  async createDedicatedAccount(params: {
    customerCode: string;
    preferredBank: string;
    phone: string;
    firstName?: string;
    lastName?: string;
  }): Promise<DedicatedAccountResult> {
    const banks = this.dvaBankCandidates();
    let lastError: unknown;

    for (const bank of banks) {
      try {
        return await this.requestDedicatedAccount({ ...params, preferredBank: bank });
      } catch (err) {
        lastError = err;

        // Only a bank-availability problem (e.g. "wema is not available in
        // test mode") should fall through to the next candidate. Genuine
        // failures — DVA not enabled on the Paystack business, invalid
        // customer code, etc. — must surface immediately instead of being
        // masked as a bank-selection issue.
        if (!this.isDvaBankUnavailableError(err)) {
          throw err;
        }
      }
    }

    throw lastError;
  }

  /** Single DVA-creation attempt for one specific bank. */
  private async requestDedicatedAccount(params: {
    customerCode: string;
    preferredBank: string;
    phone: string;
    firstName?: string;
    lastName?: string;
  }): Promise<DedicatedAccountResult> {
    try {
      interface DedicatedAccountShape {
        id?: number | string;
        bank?: { name?: string };
        account_name?: string;
        account_number?: string;
        assigned?: boolean;
        active?: boolean;
        currency?: string;
        assignment?: {
          account_number?: string;
          bank?: { name?: string };
          currency?: string;
        };
      }

      const response = await this.client.post<
        PaystackResponse<{
          dedicated_account?: DedicatedAccountShape;
        }>
      >('/dedicated_account', {
        customer: params.customerCode,
        preferred_bank: params.preferredBank,
        phone: params.phone,
        first_name: params.firstName,
        last_name: params.lastName,
        country: 'NG',
      });

      const da = response.data.data.dedicated_account ?? {};
      const assignment = da.assignment ?? {};

      return {
        accountId: da.id ? String(da.id) : undefined,
        accountNumber: da.account_number ?? assignment.account_number ?? '',
        accountName: da.account_name ?? '',
        bankName: da.bank?.name ?? assignment.bank?.name ?? '',
        currency: da.currency ?? assignment.currency ?? 'NGN',
        active: da.active ?? da.assigned ?? true,
      };
    } catch (error) {
      return this.handleError('dedicated account creation', error);
    }
  }

  /**
   * Lists the dedicated virtual accounts assigned to a customer. Used to
   * recover an existing assignment when `createDedicatedAccount` fails
   * because the customer already has one (e.g. after a partial
   * provisioning attempt crashed before persisting).
   */
  async fetchDedicatedAccounts(
    customerCode: string,
  ): Promise<DedicatedAccountResult[]> {
    try {
      interface DedicatedAccountShape {
        id?: number | string;
        bank?: { name?: string };
        account_name?: string;
        account_number?: string;
        assigned?: boolean;
        active?: boolean;
        currency?: string;
        assignment?: {
          account_number?: string;
          bank?: { name?: string };
          currency?: string;
        };
      }

      const response = await this.client.get<
        PaystackResponse<
          Array<{
            id?: number | string;
            dedicated_account?: DedicatedAccountShape;
          }>
        >
      >('/dedicated_account', {
        params: { customer_code: customerCode },
      });

      const list = Array.isArray(response.data.data) ? response.data.data : [];

      return list
        .map((entry) => {
          const da = entry.dedicated_account ?? {};
          const assignment = da.assignment ?? {};

          return {
            accountId: entry.id
              ? String(entry.id)
              : da.id
                ? String(da.id)
                : undefined,
            accountNumber: da.account_number ?? assignment.account_number ?? '',
            accountName: da.account_name ?? '',
            bankName: da.bank?.name ?? assignment.bank?.name ?? '',
            currency: da.currency ?? assignment.currency ?? 'NGN',
            active: da.active ?? da.assigned ?? false,
          };
        })
        .filter((entry) => entry.accountNumber.length > 0);
    } catch (error) {
      return this.handleError('dedicated account fetch', error);
    }
  }

  /**
   * Deactivates a dedicated virtual account so a fresh number can be
   * assigned (used by the refresh flow). Best-effort — the caller decides
   * how to proceed if Paystack rejects the deactivation.
   */
  async deactivateDedicatedAccount(accountId: string): Promise<void> {
    try {
      await this.client.post<PaystackResponse<null>>(
        `/dedicated_account/${encodeURIComponent(accountId)}/deactivate`,
        {},
      );
    } catch (error) {
      this.handleError('dedicated account deactivation', error);
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
   * The OTP to use when finalizing transfers in test mode. Defaults to
   * `123456` (the historical Paystack test-mode OTP), but many test accounts
   * now deliver a real OTP to the email/phone registered on the Paystack
   * dashboard — set `PAYSTACK_TRANSFER_OTP` to that code to make test
   * withdrawals complete. See `.env.example`.
   */
  testTransferOtp(): string {
    return this.configService.get<string>('PAYSTACK_TRANSFER_OTP') ?? '123456';
  }

  /**
   * Resolves an OTP for a pending transfer. In test mode the OTP is
   * normally `123456` (see `testTransferOtp()`). In live mode this would be
   * the OTP sent to the recipient's phone.
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
