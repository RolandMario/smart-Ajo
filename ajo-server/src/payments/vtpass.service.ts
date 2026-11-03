import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';

/** Used when VTPASS_BASE_URL is not set. */
const DEFAULT_BASE_URL = 'https://vtpass.com/api/';

/**
 * VTpass reports success as `code: "000"`. A few endpoints echo the code in
 * `response_description` instead, so both fields are accepted — but only when
 * `code` itself is absent, so a real failure code can never be masked.
 */
const SUCCESS_CODES = new Set(['000', '0']);

/** `087 INVALID CREDENTIALS` — the key pair on this server was rejected. */
const INVALID_CREDENTIALS_CODE = '087';

/** Codes VTpass documents as transient: requery, then let the member retry. */
const TRANSIENT_CODES = new Set(['016', '017']);

/** `content.transactions.status` values that mean the goods were delivered. */
const DELIVERED_STATUSES = new Set(['delivered', 'success', 'successful']);

/**
 * A prepaid vend can come back `delivered` before the disco has generated the
 * token — VTpass then has it on `/requery` a moment later. One immediate
 * requery plus two short retries covers that lag, so a member is never debited
 * for electricity whose token we failed to hand over.
 */
const TOKEN_REQUERY_ATTEMPTS = 3;
const TOKEN_REQUERY_DELAY_MS = 2_000;

/** Every VTpass env var the live vending flow needs. */
const REQUIRED_ENV = [
  'VTPASS_API_KEY',
  'VTPASS_PUBLIC_KEY',
  'VTPASS_SECRET_KEY',
] as const;

/** `Customer_Name`, `customer_name` and `customerName` all collapse to this. */
function fieldKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Flattens VTpass payloads into one case- and separator-insensitive lookup map.
 *
 * VTpass is inconsistent about response casing — `merchant-verify` returns
 * `Customer_Name`/`Current_Bouquet`/`Renewal_Amount` for cable smartcards but
 * snake_case (`customer_name`) elsewhere — and sometimes nests the customer
 * under `content.transactions`. Later sources win, so callers pass the generic
 * `content` first and its specific `transactions` object second.
 */
function flattenFields(
  ...sources: (Record<string, unknown> | undefined)[]
): Map<string, unknown> {
  const flat = new Map<string, unknown>();
  for (const source of sources) {
    for (const [key, value] of Object.entries(source ?? {})) {
      if (value === null || value === undefined) continue;
      flat.set(fieldKey(key), value);
    }
  }
  return flat;
}

/** First non-empty text value among `keys`, whatever their casing. */
function pickText(
  flat: Map<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = flat.get(fieldKey(key));
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

/** Same as `pickText`, coerced to a number — VTpass sends amounts as strings. */
function pickAmount(
  flat: Map<string, unknown>,
  ...keys: string[]
): number | undefined {
  const text = pickText(flat, ...keys);
  if (text === undefined) return undefined;
  const amount = Number(text.replace(/,/g, ''));
  return Number.isFinite(amount) ? amount : undefined;
}

/** VTpass writes `"N/A"` (or `null`, or `-`) wherever it has nothing. */
function isPlaceholder(value: string): boolean {
  return /^(n\/?a|nil|none|null|-)$/i.test(value.trim());
}

/** Trims a free-text field, dropping VTpass' `"N/A"` filler. */
function readText(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text && !isPlaceholder(text) ? text : undefined;
}

/**
 * The vended token as the member needs it — bare digits.
 *
 * VTpass labels it inside the value (`"token": "Token : 26362054405982757802"`,
 * and the same string in `purchased_code`/`extras`), which is unreadable on a
 * receipt and breaks "copy the token" flows, so the label is stripped here.
 */
function readToken(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return undefined;
  const token = value.replace(/^\s*token\s*[:-]?\s*/i, '').trim();
  return token && !isPlaceholder(token) ? token : undefined;
}

/** `"79.9 kWh"` → `"79.9"`; the receipt's row label already says the unit. */
function readUnits(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return undefined;
  const units = value.replace(/\s*kwh\s*$/i, '').trim();
  return units && !isPlaceholder(units) ? units : undefined;
}

interface VTPassTransaction {
  transactionId?: string;
  status?: string;
  commission?: number;
  customer_name?: string;
  name?: string;
  customer_address?: string;
  address?: string;
  product_name?: string;
  current_package?: string;
  outstanding_balance?: number;
  /** Electricity vending: the recharge token + unit count returned on success. */
  token?: string;
  units?: string | number;
  main_token?: string;
  mainToken?: string;
  disco_name?: string;
  /** `"Token : 26362054405982757802"` — where IKEDC puts the token. */
  extras?: string | null;
  purchased_code?: string;
}

interface VTPassContent {
  transactions?: VTPassTransaction;
  variations?: VTPassVariation[];
  customer_name?: string;
  name?: string;
  customer_address?: string;
  address?: string;
  product_name?: string;
  current_package?: string;
  outstanding_balance?: number;
  token?: string;
  units?: string | number;
  main_token?: string;
  mainToken?: string;
  disco_name?: string;
  /** `"Token : …"` mirrored out of `transactions`. */
  extras?: string | null;
  purchased_code?: string;
  /**
   * `merchant-verify` answers `code: "000"` for a *rejected* customer too, with
   * the reason in `error` and `WrongBillersCode: true`.
   */
  error?: string;
  WrongBillersCode?: boolean;
  /**
   * Cable smartcard verification answers in PascalCase — `Customer_Name`,
   * `Current_Bouquet`, `Renewal_Amount`, `Customer_Number`, `Due_Date` — while
   * meters and vends use snake_case, so unknown keys are read through
   * `flattenFields` instead of being listed here.
   */
  [key: string]: unknown;
}

interface VTPassVariation {
  variation_code: string;
  name: string;
  variation_amount: number;
  fixedPrice: string;
}

interface VTPassResponse {
  code: string | number;
  response_description?: string;
  message?: string;
  content?: VTPassContent;
  /**
   * Electricity vends answer with the recharge details at the **top level** of
   * the body, beside `content` — `token`, `units`, `tokenAmount`, `tariff`,
   * `customerName`, … (IKEDC live: `"token": "Token : 2636…"`,
   * `"units": "79.9 kWh"`). Reading only `content` silently lost both, so every
   * prepaid receipt rendered without a token or unit count.
   */
  token?: string;
  units?: string | number;
  main_token?: string;
  mainToken?: string;
  tokenAmount?: number;
  purchased_code?: string;
  tariff?: string;
  customerName?: string;
  customerAddress?: string;
  meterNumber?: string | null;
  utilityName?: string;
  exchangeReference?: string;
}

export interface PurchaseResult {
  requestId: string;
  externalTransactionId: string;
  status: string;
  commission: number;
  /**
   * Extra user-facing details the provider returned on success, e.g. an
   * electricity recharge `token`/`units`, or the customer/package info from
   * a cable or meter vending response. Stored alongside the bill transaction
   * so receipts can show them.
   */
  providerData?: Record<string, unknown>;
}

export interface VerifyProductResult {
  valid: boolean;
  name?: string;
  address?: string;
  packageInfo?: string;
  outstanding?: number;
  message?: string;
}

export interface ServiceVariation {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
}

export interface QueryTransactionResult {
  status: string;
  externalTransactionId?: string;
}

/**
 * Client for the VTpass VTU API — the platform's only bills provider
 * (airtime, data, cable TV and electricity).
 *
 * Auth: VTpass expects `api-key` on every call, plus `public-key` on GETs and
 * `secret-key` on POSTs (vending and `merchant-verify`). Mixing those up is the
 * usual cause of `087 INVALID CREDENTIALS`.
 */
@Injectable()
export class VTPassService {
  private readonly logger = new Logger(VTPassService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey?: string;
  private readonly publicKey?: string;
  private readonly secretKey?: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.readKey('VTPASS_API_KEY');
    this.publicKey = this.readKey('VTPASS_PUBLIC_KEY');
    this.secretKey = this.readKey('VTPASS_SECRET_KEY');

    const baseURL =
      this.configService.get<string>('VTPASS_BASE_URL')?.trim() ||
      DEFAULT_BASE_URL;

    this.client = axios.create({
      baseURL: baseURL.endsWith('/') ? baseURL : `${baseURL}/`,
      // VTpass can hold a vend for ~50s before answering; anything slower is
      // treated as ambiguous and resolved with a requery.
      timeout: 60_000,
      headers: { 'Content-Type': 'application/json' },
    });

    const missing = this.missingConfig();
    if (missing.length > 0) {
      this.logger.warn(
        `VTpass is not configured — missing ${missing.join(', ')}. Bill purchases will answer 503 until the key pair is set in ajo-server/.env.`,
      );
    }
  }

  /** True when all three VTpass keys needed for vending are present. */
  isConfigured(): boolean {
    return this.missingConfig().length === 0;
  }

  /** Names of the blank VTpass env vars, for actionable error messages. */
  missingConfig(): string[] {
    return REQUIRED_ENV.filter((key) => !this.readKey(key));
  }

  private readKey(name: string): string | undefined {
    const value = this.configService.get<string>(name);
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed ? trimmed : undefined;
  }

  private assertConfigured(): void {
    const missing = this.missingConfig();
    if (missing.length === 0) return;
    throw new ServiceUnavailableException(
      `Bill payments are not configured on this server: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing. Add the VTpass key pair to ajo-server/.env and restart the server.`,
    );
  }

  private authHeaders(method: 'GET' | 'POST'): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.apiKey) headers['api-key'] = this.apiKey;
    const authKey = method === 'GET' ? this.publicKey : this.secretKey;
    if (authKey) {
      headers[method === 'GET' ? 'public-key' : 'secret-key'] = authKey;
    }
    return headers;
  }

  /**
   * VTpass requires `request_id` to start with a 12-digit timestamp
   * (YYYYMMDDHHmm) and stay unique per transaction; 12 random hex characters
   * are appended for that. The value doubles as the idempotency key for
   * `/requery`, which is how an ambiguous vend is resolved.
   */
  private getRequestId(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    const stamp =
      `${now.getFullYear()}` +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      pad(now.getHours()) +
      pad(now.getMinutes());
    return `${stamp}${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }

  /** Single source of truth for "did VTpass accept this call?". */
  private isSuccessResponse(data: VTPassResponse): boolean {
    const code = String(data.code ?? '').trim();
    const description = String(data.response_description ?? '').trim();
    const codeOk =
      SUCCESS_CODES.has(code) ||
      (code === '' && SUCCESS_CODES.has(description));
    if (!codeOk) return false;

    // `000` can still carry a payload-level rejection, e.g. merchant-verify's
    // { error: "...", WrongBillersCode: true } for an unknown smartcard.
    const content = data.content ?? {};
    if (content.WrongBillersCode === true) return false;

    const status = String(content.transactions?.status ?? '').toLowerCase();
    return status !== 'failed' && status !== 'reversed';
  }

  /** True when a (re)query payload says the goods reached the customer. */
  private isDelivered(data: VTPassResponse | null | undefined): boolean {
    const status = String(
      data?.content?.transactions?.status ?? '',
    ).toLowerCase();
    return DELIVERED_STATUSES.has(status);
  }

  /** Best human-readable reason from a VTpass payload (skips the "000" echo). */
  private describeFailure(data: VTPassResponse): string {
    const candidates: unknown[] = [
      data.content?.error,
      data.message,
      data.response_description,
    ];
    for (const candidate of candidates) {
      const text = typeof candidate === 'string' ? candidate.trim() : '';
      if (text && !SUCCESS_CODES.has(text)) return text;
    }
    return 'VTpass did not confirm this transaction';
  }

  /**
   * Turns a VTpass failure payload into the HTTP exception the member app
   * shows. Credential and transient failures are 503 (a server/platform
   * problem, nothing charged) while everything else is a 400 the member can
   * act on (wrong plan, insufficient VTpass float, etc.).
   */
  private toFailureException(
    label: string,
    data: VTPassResponse,
    requestId?: string,
  ): Error {
    const code = String(data.code ?? '').trim();
    const reason = this.describeFailure(data);
    const ref = requestId ? ` (ref ${requestId})` : '';

    if (code === INVALID_CREDENTIALS_CODE) {
      return new ServiceUnavailableException(
        'Bill payments are unavailable: VTpass rejected the server credentials (087 INVALID CREDENTIALS). Update VTPASS_API_KEY / VTPASS_PUBLIC_KEY / VTPASS_SECRET_KEY and restart the server.',
      );
    }
    if (TRANSIENT_CODES.has(code)) {
      return new ServiceUnavailableException(
        `${label} purchase could not be completed right now (VTpass ${code}: ${reason})${ref}. You were not charged — please try again in a moment.`,
      );
    }
    return new BadRequestException(`${label} purchase failed: ${reason}${ref}`);
  }

  private handleError(
    action: string,
    error: unknown,
    requestId?: string,
  ): never {
    const ref = requestId ? ` (ref ${requestId})` : '';

    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const body = error.response?.data as VTPassResponse | undefined;
      this.logger.error(
        `VTpass ${action} failed: status=${status}, body=${JSON.stringify(body)}`,
      );
      if (body && typeof body === 'object') {
        if (String(body.code ?? '').trim() === INVALID_CREDENTIALS_CODE) {
          throw this.toFailureException(action, body, requestId);
        }
        const message = this.describeFailure(body);
        if (status && status >= 400 && status < 500) {
          throw new BadRequestException(
            `VTpass ${action} failed: ${message}${ref}`,
          );
        }
        throw new ServiceUnavailableException(
          `VTpass ${action} is temporarily unavailable${ref}: ${message}`,
        );
      }
      throw new ServiceUnavailableException(
        `VTpass ${action} is temporarily unavailable${ref}: ${error.message}`,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(`VTpass ${action} failed: ${message}`);
    throw new ServiceUnavailableException(
      `VTpass ${action} is temporarily unavailable${ref}: ${message}`,
    );
  }

  private toPurchaseResult(
    requestId: string,
    data: VTPassResponse,
  ): PurchaseResult {
    const content = data.content ?? {};
    const tx = content.transactions;

    // Whitelist the user-facing fields worth persisting on a receipt. VTPass
    // nest most of these under `content.transactions`, mirror key values at the
    // top level of `content`, and put the electricity token/units at the top
    // level of the *body* — every one of those shapes is read here.
    const providerData: Record<string, unknown> = {};
    const add = (key: string, ...values: unknown[]) => {
      for (const value of values) {
        if (value !== undefined && value !== null && value !== '') {
          providerData[key] = value;
          return;
        }
      }
    };
    // The token is the one thing a prepaid member cannot recover without
    // calling support, so every place VTpass has been seen to put it is tried:
    // `content.transactions` (older docs/API), the body's top level (live IKEDC
    // vends), and `extras`/`purchased_code`, which carry it as a labelled string.
    add(
      'token',
      readToken(tx?.token),
      readToken(content.token),
      readToken(data.token),
      readToken(tx?.main_token),
      readToken(content.main_token),
      readToken(data.main_token),
      readToken(tx?.mainToken),
      readToken(content.mainToken),
      readToken(data.mainToken),
      readToken(tx?.extras),
      readToken(content.extras),
      readToken(tx?.purchased_code),
      readToken(content.purchased_code),
      readToken(data.purchased_code),
    );
    // `"79.9 kWh"` → `79.9`: the receipt's own row label carries the unit.
    add(
      'units',
      readUnits(tx?.units),
      readUnits(content.units),
      readUnits(data.units),
    );
    add('discoName', readText(tx?.disco_name), readText(content.disco_name));
    add(
      'customerName',
      readText(tx?.customer_name),
      readText(tx?.name),
      readText(content.customer_name),
      readText(content.name),
      readText(data.customerName),
    );
    add(
      'customerAddress',
      readText(tx?.customer_address),
      readText(tx?.address),
      readText(content.customer_address),
      readText(content.address),
      readText(data.customerAddress),
    );
    add(
      'packageName',
      readText(tx?.product_name),
      readText(tx?.current_package),
      readText(content.product_name),
      readText(content.current_package),
    );
    add('outstanding', tx?.outstanding_balance, content.outstanding_balance);

    return {
      requestId,
      externalTransactionId: tx?.transactionId ?? requestId,
      status: tx?.status ?? 'delivered',
      commission: Number(tx?.commission ?? 0) || 0,
      ...(Object.keys(providerData).length > 0 ? { providerData } : {}),
    };
  }

  /**
   * Posts a vend to `/pay` and decides the real outcome.
   *
   * VTpass guidance: a non-`000` answer — pending, processing, a network error,
   * even code 016 "TRANSACTION FAILED" — does not prove the vend failed; it may
   * still be delivered on their side. So every ambiguous result is requeried
   * with the same `request_id` before being reported as a failure. That is what
   * stops a wallet debit from being refunded while the customer's airtime,
   * data, bouquet or electricity token was in fact delivered.
   */
  private async submitPurchase(
    action: string,
    label: string,
    payload: Record<string, unknown>,
  ): Promise<PurchaseResult> {
    const requestId = String(payload.request_id);
    let data: VTPassResponse;

    try {
      const response = await this.client.post<VTPassResponse>('pay', payload, {
        headers: this.authHeaders('POST'),
      });
      data = response.data ?? { code: '' };
      this.logger.log(`VTpass ${action} response: ${JSON.stringify(data)}`);
    } catch (error) {
      // The request may still have reached VTpass — confirm before failing.
      const requery = await this.fetchRequery(requestId);
      if (this.isDelivered(requery)) {
        this.logger.warn(
          `VTpass ${action} threw (${error instanceof Error ? error.message : String(error)}) but requery confirms delivery — treating as success`,
        );
        return this.toPurchaseResult(requestId, requery ?? { code: '000' });
      }
      return this.handleError(`${label} purchase`, error, requestId);
    }

    if (this.isSuccessResponse(data)) {
      const result = this.toPurchaseResult(requestId, data);
      this.logger.log(
        `${label} purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`,
      );
      return result;
    }

    this.logger.warn(
      `VTpass ${action} not confirmed (code=${String(data.code)}, reason=${this.describeFailure(data)}) — requerying ${requestId}`,
    );
    const requery = await this.fetchRequery(requestId);
    if (this.isDelivered(requery)) {
      const result = this.toPurchaseResult(requestId, requery ?? data);
      this.logger.warn(
        `${label} purchase confirmed by requery: requestId=${requestId}, transactionId=${result.externalTransactionId}`,
      );
      return result;
    }

    this.logger.error(
      `${label} purchase failed: requestId=${requestId}, response=${JSON.stringify(data)}`,
    );
    throw this.toFailureException(label, data, requestId);
  }

  private async fetchRequery(
    requestId: string,
  ): Promise<VTPassResponse | null> {
    try {
      const response = await this.client.post<VTPassResponse>(
        'requery',
        { request_id: requestId },
        { headers: this.authHeaders('POST') },
      );
      this.logger.log(
        `VTpass requery ${requestId}: ${JSON.stringify(response.data)}`,
      );
      return response.data ?? null;
    } catch (error) {
      this.logger.warn(
        `VTpass requery failed for ${requestId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Recovers a prepaid token the vend response did not carry.
   *
   * Live IKEDC vends regularly answer `delivered` while the token is still being
   * generated at the disco; VTpass holds it on `/requery` seconds later. Without
   * this the member is debited for electricity they cannot load, and the
   * receipt has no token to show — which is exactly what happened before
   * (metadata stored only `packageName`/`customerName`). It only runs for
   * prepaid vends that came back tokenless, so the normal path costs nothing.
   */
  private async requeryForToken(
    requestId: string,
    result: PurchaseResult,
  ): Promise<PurchaseResult> {
    const merged: Record<string, unknown> = { ...(result.providerData ?? {}) };

    for (let attempt = 1; attempt <= TOKEN_REQUERY_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, TOKEN_REQUERY_DELAY_MS),
        );
      }
      const requery = await this.fetchRequery(requestId);
      if (!requery) continue;

      // A requery answers with the same fields a vend does, so the same
      // whitelist applies; existing values are never overwritten.
      const extra =
        this.toPurchaseResult(requestId, requery).providerData ?? {};
      for (const [key, value] of Object.entries(extra)) {
        const current = merged[key];
        if (current === undefined || current === '') merged[key] = value;
      }

      if (merged.token) {
        this.logger.log(
          `Electricity token recovered on requery ${requestId} (attempt ${attempt}): units=${readText(merged.units) ?? '—'}`,
        );
        return { ...result, providerData: merged };
      }
    }

    this.logger.warn(
      `Electricity vend ${requestId} is delivered but still has no token after ${TOKEN_REQUERY_ATTEMPTS} requeries — the member may need the token resent by VTpass support`,
    );
    return { ...result, providerData: merged };
  }

  async purchaseAirtime(params: {
    serviceID: string;
    phone: string;
    amount: number;
  }): Promise<PurchaseResult> {
    this.assertConfigured();
    const amount = Math.round(params.amount);
    if (amount < 50) {
      throw new BadRequestException('Airtime purchases start at ₦50');
    }
    const requestId = this.getRequestId();
    this.logger.log(
      `Initiating airtime purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, amount=${amount}`,
    );
    return this.submitPurchase('airtime', 'Airtime', {
      request_id: requestId,
      serviceID: params.serviceID,
      amount,
      phone: params.phone,
    });
  }

  async purchaseData(params: {
    serviceID: string;
    phone: string;
    variationCode: string;
  }): Promise<PurchaseResult> {
    this.assertConfigured();
    if (!params.variationCode) {
      throw new BadRequestException('A data plan must be selected');
    }
    const requestId = this.getRequestId();
    this.logger.log(
      `Initiating data purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, variationCode=${params.variationCode}`,
    );
    return this.submitPurchase('data', 'Data', {
      request_id: requestId,
      serviceID: params.serviceID,
      phone: params.phone,
      variation_code: params.variationCode,
    });
  }

  /**
   * Vends a cable/bouquet payment.
   *
   * VTpass documents two flows and they differ in what `variation_code` means:
   *
   *  - A purchase / bouquet change sends the chosen bouquet code, so the
   *    decoder is moved onto that bouquet.
   *  - A renewal extends whatever bouquet the decoder is already on. DSTV and
   *    GOtv do that from the amount alone (the `Renewal_Amount` returned by
   *    `merchant-verify`), so no `variation_code` is sent: sending one there
   *    risks *switching* the member's bouquet instead of renewing it.
   *    StarTimes has no renewal-specific flow, so it still needs the code.
   */
  async purchaseCable(params: {
    serviceID: string;
    billersCode: string;
    amount: number;
    phone: string;
    /** Bouquet/variation code — required unless `renewCurrentBouquet` is set. */
    variationCode?: string;
    /** Renew the decoder's current bouquet (amount-only DSTV/GOtv renewal). */
    renewCurrentBouquet?: boolean;
  }): Promise<PurchaseResult> {
    this.assertConfigured();
    if (!params.variationCode && !params.renewCurrentBouquet) {
      throw new BadRequestException('A cable/bouquet plan must be selected');
    }
    const requestId = this.getRequestId();
    const amount = Math.round(params.amount);
    this.logger.log(
      `Initiating cable purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${amount}, variationCode=${params.variationCode ?? '(current bouquet)'}`,
    );
    const payload: Record<string, unknown> = {
      request_id: requestId,
      serviceID: params.serviceID,
      billersCode: params.billersCode,
      amount,
      phone: params.phone,
      subscription_type: 'renew',
    };
    if (params.variationCode) payload.variation_code = params.variationCode;
    return this.submitPurchase('cable', 'Cable', payload);
  }

  async purchaseElectricity(params: {
    serviceID: string;
    billersCode: string;
    amount: number;
    phone: string;
    /** `prepaid` | `postpaid` — sent to VTpass as `variation_code`. */
    variationCode: string;
  }): Promise<PurchaseResult> {
    this.assertConfigured();
    const amount = Math.round(params.amount);
    if (amount < 500) {
      throw new BadRequestException('Electricity payments start at ₦500');
    }

    // Vending to the wrong meter hands the token to someone else, so the meter
    // is always re-verified here even though the app verifies it while typing.
    const meter = await this.verifyProduct({
      serviceID: params.serviceID,
      billersCode: params.billersCode,
    });
    if (!meter.valid) {
      throw new BadRequestException(
        meter.message || 'Meter number could not be verified',
      );
    }

    const requestId = this.getRequestId();
    this.logger.log(
      `Initiating electricity purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${amount}, variationCode=${params.variationCode}`,
    );
    const result = await this.submitPurchase('electricity', 'Electricity', {
      request_id: requestId,
      serviceID: params.serviceID,
      billersCode: params.billersCode,
      variation_code: params.variationCode,
      amount,
      phone: params.phone,
    });

    // A prepaid vend that returned no token is unusable as-is — the member
    // needs the digits to load the meter. IKEDC usually has them on a requery
    // a couple of seconds later, so ask before handing back the receipt.
    const vendResult =
      params.variationCode === 'prepaid' && !result.providerData?.token
        ? await this.requeryForToken(requestId, result)
        : result;

    // The vend response rarely repeats the customer, but the receipt should show
    // who the token was bought for — carry over the verified meter name.
    const details = vendResult.providerData ?? {};
    if (!details.customerName && meter.name) {
      return {
        ...vendResult,
        providerData: { ...details, customerName: meter.name },
      };
    }
    return vendResult;
  }

  /**
   * `merchant-verify` — resolves the customer behind a meter or smartcard.
   *
   * VTpass answers `code: "000"` even for an unknown biller code, flagging the
   * rejection with `content.error` + `content.WrongBillersCode`, so both the
   * code and the payload are checked here.
   */
  async verifyProduct(params: {
    serviceID: string;
    billersCode: string;
  }): Promise<VerifyProductResult> {
    this.assertConfigured();
    const requestId = this.getRequestId();
    let data: VTPassResponse;

    try {
      const response = await this.client.post<VTPassResponse>(
        'merchant-verify',
        {
          request_id: requestId,
          serviceID: params.serviceID,
          billersCode: params.billersCode,
        },
        { headers: this.authHeaders('POST') },
      );
      data = response.data ?? { code: '' };
      this.logger.log(
        `VTpass merchant-verify ${params.serviceID}/${params.billersCode}: ${JSON.stringify(data)}`,
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const body = error.response.data as VTPassResponse | undefined;
        return {
          valid: false,
          message: body ? this.describeFailure(body) : 'Customer not found',
        };
      }
      return this.handleError('customer verification', error, requestId);
    }

    const content = data.content ?? {};
    if (content.WrongBillersCode === true || content.error) {
      return {
        valid: false,
        message: content.error ?? 'Customer details could not be found',
      };
    }
    if (!this.isSuccessResponse(data)) {
      return { valid: false, message: this.describeFailure(data) };
    }

    const tx = content.transactions;
    // Cable smartcards answer in PascalCase (`Customer_Name`, `Current_Bouquet`,
    // `Renewal_Amount`), meters in snake_case, and either may be nested under
    // `transactions` — so the fields are read through one flattened lookup.
    const flat = flattenFields(
      content,
      tx as Record<string, unknown> | undefined,
    );
    const name = pickText(flat, 'customer_name', 'name');

    // A verification with no customer identity is unusable for confirmation.
    if (!name) {
      return { valid: false, message: 'Customer details could not be found' };
    }

    return {
      valid: true,
      name,
      address: pickText(flat, 'customer_address', 'address'),
      packageInfo: pickText(
        flat,
        'current_bouquet',
        'current_package',
        'product_name',
      ),
      outstanding: pickAmount(flat, 'renewal_amount', 'outstanding_balance'),
      message: data.response_description,
    };
  }

  async getServiceVariations(serviceID: string): Promise<ServiceVariation[]> {
    try {
      const response = await this.client.get<VTPassResponse>(
        'service-variations',
        {
          params: { serviceID },
          headers: this.authHeaders('GET'),
        },
      );

      const data = response.data ?? { code: '' };
      this.logger.log(
        `VTpass service-variations ${serviceID}: code=${String(data.code)}, description=${String(data.response_description ?? '')}`,
      );
      if (!this.isSuccessResponse(data)) {
        throw this.toFailureException('Catalog', data);
      }

      const variations = data.content?.variations ?? [];
      return variations.map((v) => ({
        variationCode: String(v.variation_code),
        name: String(v.name),
        amount: Number(v.variation_amount),
        fixedPrice: String(v.fixedPrice) === 'Yes',
      }));
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ServiceUnavailableException
      ) {
        throw error;
      }
      return this.handleError('service variations', error);
    }
  }

  async queryTransaction(requestId: string): Promise<QueryTransactionResult> {
    this.assertConfigured();
    const data = await this.fetchRequery(requestId);
    const tx = data?.content?.transactions ?? {};
    return {
      status: tx.status ?? 'unknown',
      externalTransactionId: tx.transactionId,
    };
  }
}
