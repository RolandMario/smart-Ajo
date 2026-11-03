import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
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

export interface PaystackCustomerResult {
  customerCode: string;
  email?: string;
  phone?: string;
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

/** Shape of a single Dedicated Virtual Account in Paystack responses. */
interface DedicatedAccountShape {
  id?: number | string;
  bank?: { name?: string; slug?: string };
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

export interface InitiateTransferResult {
  transferCode: string;
  status: string;
}

/**
 * Returned to clients whenever a payment operation is attempted while the
 * server has no usable Paystack secret key.
 *
 * Why this exists: `PAYSTACK_SECRET_KEY` used to default to a committed
 * (and long-since revoked) test key, so Paystack answered every request
 * with 401 `Invalid key`. Payouts and withdrawals then surfaced that raw
 * string ("Paystack error: Invalid key"), which reads like an app bug
 * instead of a deployment/configuration problem. Everything that talks to
 * Paystack now fails with this actionable message instead.
 */
export const PAYSTACK_NOT_CONFIGURED_MESSAGE =
  'Payments are not configured on this server: PAYSTACK_SECRET_KEY is missing or invalid. ' +
  'Set it to a valid Paystack secret key (sk_test_… for test mode, sk_live_… for live) and restart the server.';

/** Values that look like a secret key but are placeholders/examples. */
const PAYSTACK_PLACEHOLDER_PATTERN =
  /your[-_ ]?paystack|placeholder|changeme|replace[-_ ]?me|undefined|null|xxx+/i;

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
   * Paystack DVA issuing banks (Nigeria). These are Paystack's
   * `provider_slug` values — note `wema-bank`, NOT `wema` (that string is
   * rejected with "Invalid bank"). Live businesses typically only offer
   * `wema-bank` and `titan-paystack`; in test mode Wema is unavailable and
   * Paystack accepts Providus/Sterling instead. `GET
   * /dedicated_account/available_providers` is the authority for a given
   * business — this pool is only the fallback/ordering when that call fails.
   */
  private readonly DVA_BANK_POOL = [
    'wema-bank',
    'titan-paystack',
    'wema',
    'providus',
    'sterling',
  ] as const;

  /** Cached `/dedicated_account/available_providers` result (5 min TTL). */
  private providerCache?: { fetchedAt: number; slugs: string[] };

  constructor(private configService: ConfigService) {
    // Secrets copied into env files/dashboards frequently pick up wrapping
    // quotes or surrounding whitespace; both make Paystack reject the key
    // with the opaque "Invalid key". Normalize once, here.
    this.secretKey = this.normalizeSecret(
      this.configService.get<string>('PAYSTACK_SECRET_KEY'),
    );
    const baseURL =
      this.configService.get<string>('PAYSTACK_BASE_URL')?.trim() ||
      'https://api.paystack.co';

    this.client = axios.create({
      baseURL,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!this.isConfigured()) {
      this.logger.warn(
        'PAYSTACK_SECRET_KEY is missing or a placeholder — wallet funding, ' +
          'virtual accounts, savings withdrawals and group payouts will fail ' +
          'with a 503 until a valid key is configured (see PAYSTACK_NOT_CONFIGURED_MESSAGE).',
      );
    }
  }

  /** Strips surrounding whitespace/quotes from a configured secret. */
  private normalizeSecret(value: string | undefined | null): string {
    if (!value) return '';

    return value
      .trim()
      .replace(/^["'`]+/, '')
      .replace(/["'`]+$/, '')
      .trim();
  }

  /**
   * `true` when the configured secret key looks like a real Paystack key.
   * This is a cheap sanity check (shape only) — Paystack remains the
   * authority on whether the key is still valid. It exists so we can fail
   * fast, with an actionable message, before money-mutating work happens.
   */
  isConfigured(): boolean {
    if (!this.secretKey.startsWith('sk_')) return false;
    if (this.secretKey.length < 20) return false;

    return !PAYSTACK_PLACEHOLDER_PATTERN.test(this.secretKey);
  }

  /** Throws a 503 with an actionable message when payments are unusable. */
  assertConfigured(): void {
    if (this.isConfigured()) return;

    throw new ServiceUnavailableException(PAYSTACK_NOT_CONFIGURED_MESSAGE);
  }

  /**
   * Paystack answered 401 `Invalid key` — the configured secret is revoked,
   * truncated, or belongs to a different Paystack account. Retrying cannot
   * help, so callers get the configuration message instead of a raw 401.
   */
  private isInvalidKeyError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return false;
    if (error.response?.status !== 401) return false;

    const data = error.response.data as
      | { message?: string; code?: string }
      | undefined;
    const message = (data?.message ?? '').toLowerCase();

    return data?.code === 'invalid_Key' || message.includes('invalid key');
  }

  /** Paystack's `message` for an Axios error, or the error's own message. */
  private errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { message?: string } | undefined;

      return data?.message ?? error.message;
    }

    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Paystack answered `Customer not found` (404) — the code was issued in the
   * other mode (test/live have separate customer lists) or the customer was
   * deleted on the dashboard. Provisioning must not keep retrying with it.
   */
  isCustomerNotFoundError(error: unknown): boolean {
    return /customer (?:not found|does not exist)|customer_not_found/i.test(
      this.errorMessage(error),
    );
  }

  /**
   * Paystack refused to create a customer because one already exists for the
   * email. Recoverable: look the existing customer up and reuse its code.
   */
  isDuplicateCustomerError(error: unknown): boolean {
    return /customer (?:already )?exists|already (?:exists|been taken)|duplicate/i.test(
      this.errorMessage(error),
    );
  }

  /**
   * Paystack refused to create a DVA because this customer already has one.
   * Recoverable: list the customer's accounts and adopt the assignment.
   */
  isDedicatedAccountExistsError(error: unknown): boolean {
    return /already (?:has|have) (?:a )?dedicated account|dedicated account (?:already )?(?:exists|assigned)/i.test(
      this.errorMessage(error),
    );
  }

  private handleError(action: string, error: unknown): never {
    if (axios.isAxiosError(error)) {
      const message =
        (error.response?.data as { message?: string } | undefined)?.message ??
        error.message;
      this.logger.error(`Paystack ${action} failed: ${message}`);

      if (this.isInvalidKeyError(error)) {
        this.logger.error(PAYSTACK_NOT_CONFIGURED_MESSAGE);
        throw new ServiceUnavailableException(PAYSTACK_NOT_CONFIGURED_MESSAGE);
      }

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
   *
   * `metadata` is used to tag Ajo-owned customers (`{ app: 'ajo', userId }`)
   * so the Paystack dashboard makes it obvious which product minted a
   * customer, and so a shared integration can be reconciled later.
   */
  async createCustomer(params: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }): Promise<CreateCustomerResult> {
    try {
      const body: Record<string, unknown> = {};
      if (params.phone) body.phone = params.phone;
      if (params.email) body.email = params.email;
      if (params.firstName) body.first_name = params.firstName;
      if (params.lastName) body.last_name = params.lastName;
      if (params.metadata) body.metadata = params.metadata;

      const response = await this.client.post<
        PaystackResponse<{ customer_code: string }>
      >('/customer', body);

      return { customerCode: response.data.data.customer_code };
    } catch (error) {
      return this.handleError('customer creation', error);
    }
  }

  /**
   * Looks up a Paystack customer by code. Returns `null` (instead of
   * throwing) when Paystack says the customer doesn't exist — that is an
   * expected outcome for codes carried over from the other mode
   * (test ⇄ live), which provisioning recovers from.
   */
  async fetchCustomer(
    customerCode: string,
  ): Promise<PaystackCustomerResult | null> {
    try {
      const response = await this.client.get<
        PaystackResponse<{
          customer_code?: string;
          email?: string;
          phone?: string;
        }>
      >(`/customer/${encodeURIComponent(customerCode)}`);

      const data = response.data?.data ?? {};

      return {
        customerCode: data.customer_code ?? customerCode,
        email: data.email,
        phone: data.phone,
      };
    } catch (error) {
      if (this.isCustomerNotFoundError(error)) {
        this.logger.warn(
          `Paystack customer ${customerCode} not found in this mode — it will be re-provisioned`,
        );

        return null;
      }

      return this.handleError('customer lookup', error);
    }
  }

  /**
   * Finds the (first) Paystack customer registered with this email, or
   * `null`. Used before creating a customer so provisioning reuses an
   * existing record instead of hitting Paystack's duplicate-email error.
   */
  async fetchCustomerByEmail(
    email: string,
  ): Promise<PaystackCustomerResult | null> {
    try {
      const response = await this.client.get<
        PaystackResponse<
          Array<{ customer_code?: string; email?: string; phone?: string }>
        >
      >('/customer', { params: { email } });

      const list = Array.isArray(response.data?.data) ? response.data.data : [];
      const match = list.find(
        (entry) =>
          (entry.email ?? '').toLowerCase() === email.trim().toLowerCase(),
      );

      if (!match?.customer_code) return null;

      return {
        customerCode: match.customer_code,
        email: match.email,
        phone: match.phone,
      };
    } catch (error) {
      if (this.isCustomerNotFoundError(error)) return null;

      return this.handleError('customer lookup', error);
    }
  }

  /**
   * The preferred bank to request Dedicated Virtual Accounts from
   * (`PAYSTACK_DVA_PREFERRED_BANK`). This is the FIRST bank attempted; the
   * rest of the candidates are tried when Paystack rejects it — either
   * because the bank isn't available in the current mode or because the
   * business doesn't offer it.
   *
   * Values are Paystack `provider_slug`s (`wema-bank`, `titan-paystack`,
   * `providus`, `sterling`), NOT bank names.
   */
  dvaPreferredBank(): string {
    return (
      this.configService.get<string>('PAYSTACK_DVA_PREFERRED_BANK') ??
      'wema-bank'
    );
  }

  /**
   * Banks that can actually issue a DVA on this Paystack business, straight
   * from `GET /dedicated_account/available_providers`. Cached for 5 minutes
   * because it only changes with Paystack's configuration. Returns `[]` when
   * the call fails (the caller then falls back to the static pool).
   */
  async fetchDedicatedAccountProviders(): Promise<string[]> {
    if (
      this.providerCache &&
      Date.now() - this.providerCache.fetchedAt < 5 * 60_000
    ) {
      return this.providerCache.slugs;
    }

    try {
      const response = await this.client.get<
        PaystackResponse<
          Array<{ provider_slug?: string; bank_name?: string; id?: number }>
        >
      >('/dedicated_account/available_providers');

      const list = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];
      const slugs = list
        .map((provider) => provider.provider_slug?.trim().toLowerCase())
        .filter((slug): slug is string => !!slug);

      if (slugs.length > 0) {
        this.providerCache = { fetchedAt: Date.now(), slugs };

        return slugs;
      }
    } catch (error) {
      this.logger.warn(
        `Could not fetch dedicated account providers: ${this.errorMessage(error)}`,
      );
    }

    return [];
  }

  /**
   * Ordered DVA bank candidates: the preferred bank first, then the banks
   * Paystack reports as available for this business, then the static
   * fallback pool. Deduplicated so nothing is attempted twice.
   */
  dvaBankCandidates(
    available: string[] = [],
    preferred: string = this.dvaPreferredBank(),
  ): string[] {
    const ordered = [preferred, ...available, ...this.DVA_BANK_POOL];
    const seen = new Set<string>();

    return ordered
      .map((bank) => bank.trim().toLowerCase())
      .filter((bank) => {
        if (!bank || seen.has(bank)) return false;

        seen.add(bank);

        return true;
      });
  }

  /**
   * Whether an error means "this bank can't issue DVAs here" rather than a
   * general DVA failure. Paystack answers e.g. `wema is not available in test
   * mode`, `Invalid bank`, or `Bank is not supported` for a provider this
   * business can't use — all safe to skip in favour of the next candidate.
   * Genuine failures (DVA not enabled on the business, invalid customer) do
   * NOT match and surface immediately.
   */
  private isDvaBankUnavailableError(error: unknown): boolean {
    return /is not available in test mode|not available for this business|invalid (?:preferred )?bank|bank is not (?:available|supported)|unsupported bank/i.test(
      this.errorMessage(error),
    );
  }

  /**
   * Requests a Dedicated Virtual Account (DVA) for an existing customer.
   * Paystack assigns the account number (its prefix depends on the
   * preferred bank, e.g. `5900...` for Wema) — the member's phone is
   * attached to the assignment and used to reconcile inbound transfers.
   *
   * Candidates come from `/dedicated_account/available_providers`, so a live
   * business that only offers `wema-bank`/`titan-paystack` no longer fails on
   * the (invalid) `wema` slug or on a test-mode-only bank.
   */
  async createDedicatedAccount(params: {
    customerCode: string;
    preferredBank: string;
    phone: string;
    firstName?: string;
    lastName?: string;
  }): Promise<DedicatedAccountResult> {
    const providers = await this.fetchDedicatedAccountProviders();
    const banks = this.dvaBankCandidates(providers, params.preferredBank);
    let lastError: unknown;

    for (const bank of banks) {
      try {
        return await this.requestDedicatedAccount({
          ...params,
          preferredBank: bank,
        });
      } catch (err) {
        lastError = err;

        // Only a bank-availability problem should fall through to the next
        // candidate. Genuine failures — DVA not enabled on the Paystack
        // business, invalid customer code, etc. — must surface immediately
        // instead of being masked as a bank-selection issue.
        if (!this.isDvaBankUnavailableError(err)) {
          throw err;
        }

        this.logger.warn(
          `Dedicated account bank "${bank}" unavailable — trying the next provider`,
        );
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
      // Paystack returns the account FLAT under `data` for
      // POST /dedicated_account (a few legacy responses wrap it in
      // `dedicated_account`) — support both, otherwise the account number
      // silently comes back empty.
      const response = await this.client.post<
        PaystackResponse<
          DedicatedAccountShape & { dedicated_account?: DedicatedAccountShape }
        >
      >('/dedicated_account', {
        customer: params.customerCode,
        preferred_bank: params.preferredBank,
        phone: params.phone,
        first_name: params.firstName,
        last_name: params.lastName,
        country: 'NG',
      });

      const payload = response?.data?.data ?? {};
      const account = payload.dedicated_account ?? payload;

      return this.mapDedicatedAccount(account);
    } catch (error) {
      return this.handleError('dedicated account creation', error);
    }
  }

  /** Maps one Paystack DVA payload (flat or nested) to our result shape. */
  private mapDedicatedAccount(
    account: DedicatedAccountShape,
  ): DedicatedAccountResult {
    const assignment = account.assignment ?? {};

    return {
      accountId: account.id ? String(account.id) : undefined,
      accountNumber: account.account_number ?? assignment.account_number ?? '',
      accountName: account.account_name ?? '',
      bankName: account.bank?.name ?? assignment.bank?.name ?? '',
      currency: account.currency ?? assignment.currency ?? 'NGN',
      active: account.active ?? account.assigned ?? true,
    };
  }

  /**
   * Lists the dedicated virtual accounts assigned to a customer. Used to
   * recover an existing assignment when `createDedicatedAccount` fails
   * because the customer already has one (e.g. after a partial
   * provisioning attempt crashed before persisting).
   *
   * Two Paystack quirks matter here: the response is a FLAT array of
   * accounts (not nested under `dedicated_account`), and the documented
   * filter param is `customer` — `customer_code` is ignored, which would
   * return every account on the business and risk adopting someone else's
   * number.
   */
  async fetchDedicatedAccounts(
    customerCode: string,
  ): Promise<DedicatedAccountResult[]> {
    try {
      const response = await this.client.get<
        PaystackResponse<
          Array<
            DedicatedAccountShape & {
              dedicated_account?: DedicatedAccountShape;
            }
          >
        >
      >('/dedicated_account', { params: { customer: customerCode } });

      const list = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];

      return list
        .map((entry) =>
          this.mapDedicatedAccount(entry.dedicated_account ?? entry),
        )
        .filter((entry) => entry.accountNumber.length > 0);
    } catch (error) {
      return this.handleError('dedicated account fetch', error);
    }
  }

  /**
   * Deactivates a dedicated virtual account so a fresh number can be
   * assigned (used by the refresh flow). Paystack's endpoint is
   * `DELETE /dedicated_account/:id` — there is no `/deactivate` sub-path.
   * Best-effort — the caller decides how to proceed if Paystack rejects the
   * deactivation.
   */
  async deactivateDedicatedAccount(accountId: string): Promise<void> {
    try {
      await this.client.delete<PaystackResponse<null>>(
        `/dedicated_account/${encodeURIComponent(accountId)}`,
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
    // Defence in depth: every money-out path (group payouts, savings
    // withdrawals, donation payouts) funnels through here, so an
    // unconfigured deployment can never create a Paystack transfer — or
    // leave a payout/withdrawal record claiming one was attempted.
    this.assertConfigured();

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
   * The Paystack environment the server is currently talking to —
   * `live` or `test`.
   *
   * Paystack keeps SEPARATE customer, DVA and transaction lists per mode, so
   * a `CUS_…` code minted with a test key simply does not exist once the
   * server runs a live key (`GET /customer/:code` → "Customer not found").
   * Persisted alongside a DVA so provisioning can detect a mode switch and
   * re-provision instead of failing forever.
   */
  keyMode(): 'test' | 'live' {
    return this.isTestMode() ? 'test' : 'live';
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
