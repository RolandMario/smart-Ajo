import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';
import { PurchaseResult, VerifyProductResult } from './vtpass.service';

/** Reuse VTPass's result shape for meter verification responses. */
type ValidationResult = VerifyProductResult;

export type BillProviderKey = 'vtpass' | 'gladtidings';

/**
 * A single row in the plan catalog returned by a provider (used by the
 * admin sync to upsert `BillServicePlan` documents).
 */
export interface ProviderPlanInput {
  externalId: string;
  name: string;
  amount: number;
  /** Network (airtime/data) or provider (cable) label. */
  bucket: string;
  fixedPrice?: boolean;
  meta?: Record<string, unknown>;
}

interface GladiDataPlanEntry {
  id?: number;
  dataplan_id?: string | number;
  network?: number;
  plan_type?: string;
  plan_network?: string;
  month_validate?: string;
  plan?: string;
  plan_amount?: string | number;
  api_price?: number | string;
  [key: string]: unknown;
}

interface GladiAirtimeNetworkEntry {
  network?: number;
  network_name?: string;
  percent?: number;
  api_percent?: number | string;
}

interface GladiCablePlanEntry {
  id?: number;
  cableplan_id?: string | number;
  cable?: string;
  package?: string;
  plan_amount?: string | number;
}

interface GladiCatalog {
  data_plans?: Array<{ name?: string; items?: GladiDataPlanEntry[] }>;
  airtime_percentages?: Array<{
    name?: string;
    items?: GladiAirtimeNetworkEntry[];
  }>;
}

interface GladiCableResponse {
  [providerKey: string]: GladiCablePlanEntry[];
}

const GLADI_NETWORK_PK: Record<string, number> = {
  mtn: 1,
  glo: 2,
  airtel: 3,
  '9mobile': 6,
  etisalat: 6,
};
/**
 * Thin client for the Gladtidings VTU API
 * (https://www.gladtidingsdata.com/api/).
 *
 * CONFIRMED endpoints (verified live):
 *  - GET  /services/    public data catalog (data plans + airtime networks)
 *  - GET  /cable/       cable plans grouped by provider
 *  - POST /topup/       airtime topup  {Ported_number, network:pk, amount, Phone}
 *  - POST /data/        data bundle     {Ported_number, network:pk, plan:pk, plan_amount, Phone}
 *
 * BEST-EFFORT / FLAGGED (verify against the dashboard):
 *  - POST /cablesub/    cable purchase (endpoint exists; exact fields unverified)
 *  - electricity        no purchase endpoint surfaced on this account — see
 *                       `purchaseElectricity`, which deliberately fails loudly.
 */
@Injectable()
export class GladTidingsService {
  private readonly logger = new Logger(GladTidingsService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly baseURL: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GLADTIDINGS_API_KEY')!;
    this.baseURL =
      this.configService.get<string>('GLADTIDINGS_BASE_URL') ??
      'https://www.gladtidingsdata.com/api/';

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.apiKey}`,
      },
      timeout: 30_000,
    });
  }

  static networkPk(network: string): number {
    const key = network.toLowerCase();
    const pk = GLADI_NETWORK_PK[key];
    if (!pk) {
      throw new BadRequestException(
        `Unsupported Gladtidings network: ${network}`,
      );
    }
    return pk;
  }

  private handleError(action: string, error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const respData: unknown = error.response?.data;
      this.logger.error(
        `Gladtidings ${action} failed: status=${status}, body=${JSON.stringify(respData)}`,
      );
      const data = respData as
        | { message?: string; detail?: string }
        | undefined;
      const message = data?.detail ?? data?.message ?? error.message;
      if (error.response && status && status >= 400 && status < 500) {
        throw new BadRequestException(`Gladtidings error: ${message}`);
      }
    } else if (error instanceof Error) {
      this.logger.error(`Gladtidings ${action} failed: ${error.message}`);
      throw new InternalServerErrorException(
        `Gladtidings ${action} failed: ${error.message}`,
      );
    } else {
      this.logger.error(`Gladtidings ${action} failed: ${String(error)}`);
    }
    throw new InternalServerErrorException(`Gladtidings ${action} failed`);
  }

  private toPurchaseResult(data: unknown): PurchaseResult {
    const raw = (data ?? {}) as Record<string, unknown>;
    const requestId = `gladi_${Date.now()}_${randomUUID().slice(0, 8)}`;

    // Whitelist user-facing fields that may come back on a vending response
    // (electricity token/units, customer/package info) so receipts can show
    // them. Only scalar values are forwarded — objects are JSON-stringified
    // and would end up as "[object Object]".
    const providerData: Record<string, unknown> = {};
    const keyMap: Record<string, string> = {
      token: 'token',
      main_token: 'token',
      mainToken: 'token',
      units: 'units',
      customer_name: 'customerName',
      name: 'customerName',
      customer_address: 'customerAddress',
      address: 'customerAddress',
      product_name: 'packageName',
      current_package: 'packageName',
      package: 'packageName',
      outstanding_balance: 'outstanding',
    };
    for (const [rawKey, outputKey] of Object.entries(keyMap)) {
      const value = raw[rawKey];
      if (
        providerData[outputKey] === undefined &&
        (typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean')
      ) {
        providerData[outputKey] = value;
      }
    }

    return {
      requestId,
      externalTransactionId: this.toString(
        raw.transaction_id ?? raw.id ?? raw.reference ?? requestId,
      ),
      status: this.toString(
        raw.status ??
          raw.message ??
          (this.isLikelySuccess(raw) ? 'delivered' : 'unknown'),
      ),
      commission: Number(raw.commission ?? 0),
      ...(Object.keys(providerData).length > 0 ? { providerData } : {}),
    };
  }

  /**
   * Safe string conversion that never falls through to `[object Object]` for
   * unexpected object payloads coming back from Gladtidings.
   */
  private toString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return JSON.stringify(value) ?? '';
  }

  private isLikelySuccess(raw: Record<string, unknown>): boolean {
    return (
      raw.success === true ||
      raw.status === 'success' ||
      raw.status === 'delivered' ||
      raw.message === 'success'
    );
  }
  /**
   * Public catalog: airtime networks + data plans from GET /services/.
   */
  async getCatalog(): Promise<{
    airtimeNetworks: GladiAirtimeNetworkEntry[];
    dataPlans: GladiDataPlanEntry[];
  }> {
    try {
      const response = await this.client.get<GladiCatalog>('services/');
      const catalog = response.data;
      const airtimeNetworks =
        catalog.airtime_percentages?.flatMap((g) => g.items ?? []) ?? [];
      const dataPlans = catalog.data_plans?.flatMap((g) => g.items ?? []) ?? [];
      return { airtimeNetworks, dataPlans };
    } catch (error) {
      return this.handleError('service catalog', error);
    }
  }

  /**
   * Cable plans grouped by provider (DSTV, GOtv, StarTimes, ...).
   */
  async getCablePlans(): Promise<GladiCablePlanEntry[]> {
    try {
      const response = await this.client.get<GladiCableResponse>('cable/');
      return Object.values(response.data).flat();
    } catch (error) {
      return this.handleError('cable plans', error);
    }
  }

  /**
   * Provider catalog, normalised to `ProviderPlanInput[]` so the bills module
   * can sync them into `BillServicePlan` regardless of service category.
   */
  async getCatalogPlans(serviceType: string): Promise<ProviderPlanInput[]> {
    if (serviceType === 'data') {
      const { dataPlans } = await this.getCatalog();
      return dataPlans.map((p) => ({
        externalId: String(p.dataplan_id ?? p.id ?? ''),
        name: `${p.plan ?? ''}`.trim() || `${p.plan_network ?? ''} data`,
        amount: Number(p.api_price ?? p.plan_amount ?? 0),
        bucket: p.plan_network ?? '',
        fixedPrice: true,
        meta: {
          plan_type: p.plan_type ?? null,
          validity: p.month_validate ?? null,
        },
      }));
    }

    if (serviceType === 'airtime') {
      const { airtimeNetworks } = await this.getCatalog();
      return airtimeNetworks.map((n) => ({
        externalId: String(n.network ?? ''),
        name: n.network_name ?? '',
        amount: 0,
        bucket: n.network_name ?? '',
        meta: { percent: n.percent },
      }));
    }

    if (serviceType === 'cable') {
      const cablePlans = await this.getCablePlans();
      return cablePlans.map((p) => ({
        externalId: String(p.cableplan_id ?? p.id ?? ''),
        name: p.package ?? '',
        amount: Number(p.plan_amount ?? 0),
        bucket: p.cable ?? '',
        fixedPrice: true,
      }));
    }

    throw new BadRequestException(
      'Gladtidings does not expose an electricity catalog; use VTPass for electricity.',
    );
  }

  // ---- Purchases ------------------------------------------------------------

  async purchaseAirtime(params: {
    network: string;
    amount: number;
    phone: string;
    ported: boolean;
  }): Promise<PurchaseResult> {
    try {
      const response = await this.client.post('topup/', {
        Ported_number: params.ported,
        network: GladTidingsService.networkPk(params.network),
        amount: params.amount,
        Phone: params.phone,
      });
      this.logger.log(
        `Gladtidings airtime response: ${JSON.stringify(response.data)}`,
      );
      return this.toPurchaseResult(response.data);
    } catch (error) {
      return this.handleError('airtime purchase', error);
    }
  }

  async purchaseData(params: {
    network: string;
    planId: string;
    planAmount: number;
    phone: string;
    ported: boolean;
  }): Promise<PurchaseResult> {
    try {
      const response = await this.client.post('data/', {
        Ported_number: params.ported,
        network: GladTidingsService.networkPk(params.network),
        plan: Number(params.planId),
        plan_amount: params.planAmount,
        Phone: params.phone,
      });
      this.logger.log(
        `Gladtidings data response: ${JSON.stringify(response.data)}`,
      );
      return this.toPurchaseResult(response.data);
    } catch (error) {
      return this.handleError('data purchase', error);
    }
  }

  /**
   * BEST-EFFORT – FLAGGED: `/api/cablesub/` exists but its exact fields are
   * unverified. Verify against the Gladtidings dashboard before enabling in
   * production. Payload below is a best guess for cable subscription.
   */
  async purchaseCable(params: {
    provider: string;
    planId: string;
    planAmount: number;
    smartCardNumber: string;
    phone: string;
  }): Promise<PurchaseResult> {
    try {
      const response = await this.client.post('cablesub/', {
        Ported_number: false,
        cable: params.provider,
        plan: params.planId,
        card: params.smartCardNumber,
        iucNumber: params.smartCardNumber,
        amount: params.planAmount,
        Phone: params.phone,
      });
      this.logger.warn(
        `Gladtidings cable purchase executed against /cablesub/ (BEST-EFFORT — verify payload): ${JSON.stringify(response.data)}`,
      );
      return this.toPurchaseResult(response.data);
    } catch (error) {
      return this.handleError('cable purchase', error);
    }
  }

  /**
   * Validates a meter number for the given disco and meter type.
   * Calls the Gladtidings validatemeter API.
   */
  async validateMeter(
    disco: string,
    meterNumber: string,
    meterType: string,
  ): Promise<ValidationResult> {
    try {
      const response = await this.client.post<ValidationResult>(
        'validatemeter',
        {
          disco,
          meterNumber,
          meterType,
        },
      );
      return response.data;
    } catch (error) {
      throw new BadRequestException(
        `Gladtidings meter validation failed: error.message`,
      );
    }
  }

  /**
   * Purchases electricity for the given disco, meter number, and amount.
   * Calls the Gladtidings billpayment API.
   */
  async purchaseElectricity(
    disco: string,
    meterNumber: string,
    amount: number,
    phone: string,
  ): Promise<PurchaseResult> {
    try {
      const response = await this.client.post<ValidationResult>('billpayment', {
        disco,
        meterNumber,
        amount,
        phone,
      });
      return this.toPurchaseResult(response.data);
    } catch (error) {
      throw new BadRequestException(
        `Gladtidings electricity purchase failed: {error.message}`,
      );
    }
  }
}
