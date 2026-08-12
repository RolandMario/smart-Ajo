import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { randomUUID } from 'crypto';

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
}

interface VTPassVariation {
  variation_code: string;
  name: string;
  variation_amount: number;
  fixedPrice: string;
}

interface VTPassResponse<T = VTPassContent> {
  code: string | number;
  response_description?: string;
  message?: string;
  content?: T;
}

export interface PurchaseResult {
  requestId: string;
  externalTransactionId: string;
  status: string;
  commission: number;
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

@Injectable()
export class VTPassService {
  private readonly logger = new Logger(VTPassService.name);
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly publicKey: string;
  private readonly secretKey: string;
  private readonly baseURL: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('VTPASS_API_KEY')!;
    this.publicKey = this.configService.get<string>('VTPASS_PUBLIC_KEY')!;
    this.secretKey = this.configService.get<string>('VTPASS_SECRET_KEY')!;
    this.baseURL = this.configService.get<string>('VTPASS_BASE_URL')!;

    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
    });
  }

  private getAuthHeaders(method: 'GET' | 'POST'): Record<string, string> {
    if (method === 'GET') {
      return { 'public-key': this.publicKey };
    }
    return { 'secret-key': this.secretKey };
  }

  private getRequestId(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const datePrefix = `${yyyy}${mm}${dd}${hh}${mi}`;
    const suffix = randomUUID().replace(/-/g, '').slice(0, 16);
    return `${datePrefix}${suffix}`;
  }

  private isSuccessCode(code: string | number): boolean {
    const codeStr =
      typeof code === 'number' ? String(code) : String(code ?? '');
    return codeStr === '000' || codeStr === '0';
  }

  private handleError(action: string, error: unknown): never {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const respData = error.response?.data;
      // Log HTTP status and full response body to aid debugging
      this.logger.error(
        `VTpass ${action} failed: status=${status}, body=${JSON.stringify(respData)}`,
      );
      const data = respData as
        | { response_description?: string; message?: string }
        | undefined;
      const message =
        data?.response_description ?? data?.message ?? error.message;
      if (
        error.response &&
        error.response.status >= 400 &&
        error.response.status < 500
      ) {
        throw new BadRequestException(`VTpass error: ${message}`);
      }
    } else if (error instanceof Error) {
      this.logger.error(`VTpass ${action} failed: ${error.message}`);
      throw new InternalServerErrorException(
        `VTpass ${action} failed: ${error.message}`,
      );
    } else {
      this.logger.error(`VTpass ${action} failed: ${String(error)}`);
    }
    throw new InternalServerErrorException(`VTpass ${action} failed`);
  }

  private toPurchaseResult(
    requestId: string,
    data: VTPassResponse,
  ): PurchaseResult {
    const tx = data.content?.transactions;
    return {
      requestId,
      externalTransactionId: tx?.transactionId ?? requestId,
      status: tx?.status ?? 'delivered',
      commission: Number(tx?.commission ?? 0),
    };
  }

  async purchaseAirtime(params: {
    serviceID: string;
    phone: string;
    amount: number;
  }): Promise<PurchaseResult> {
    const requestId = this.getRequestId();
    this.logger.log(
      `Initiating airtime purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, amount=${params.amount}`,
    );
    try {
      const payload = {
        request_id: requestId,
        serviceID: params.serviceID,
        amount: params.amount,
        phone: params.phone,
      };
      this.logger.debug(`VTpass airtime payload: ${JSON.stringify(payload)}`);
      const response = await this.client.post<VTPassResponse>('pay', payload, {
        headers: this.getAuthHeaders('POST'),
      });
      const data = response.data;
      this.logger.log(`VTpass airtime response: ${JSON.stringify(data)}`);
      const tx = data.content?.transactions;

      // A clean success: `000` code with a delivered/initiated status (or absent status).
      if (this.isSuccessCode(data.code) && tx?.status !== 'failed') {
        const result = this.toPurchaseResult(requestId, data);
        this.logger.log(
          `Airtime purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`,
        );
        return result;
      }

      // VTpass guidance: for any non-clean (pending / processing / unclear /
      // failed) synchronous response, always requery with the same request_id to
      // confirm the true final state before treating the purchase as failed. A
      // transient failure such as code=016 ("TRANSACTION FAILED") can still be
      // delivered on VTPass's side, so we must confirm via requery first.
      this.logger.log(
        `VTpass airtime not confirmed (code=${String(data.code)}, txStatus=${tx?.status}) — requerying requestId=${requestId}`,
      );
      try {
        const qr = await this.queryTransaction(requestId);
        this.logger.log(`VTpass airtime requery result: ${JSON.stringify(qr)}`);
        if (qr.status === 'delivered' || qr.status === 'success' || qr.status === 'successful') {
          const result = this.toPurchaseResult(requestId, data);
          this.logger.log(
            `Airtime purchase confirmed on requery: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`,
          );
          return result;
        }
        this.logger.warn(
          `VTpass airtime requery did not confirm delivery — status=${qr.status}, txId=${qr.externalTransactionId}`,
        );
        // Requery confirmed the purchase did not complete; fall through to throw below.
      } catch (e) {
        this.logger.error(`VTpass airtime requery failed: ${e instanceof Error ? e.message : String(e)}`);
        // Requery itself errored; fall through and throw the original failure below.
      }

      const errorMsg = data.response_description || data.message || 'VTpass purchase failed';
      this.logger.error(
        `VTpass airtime failed: code=${String(data.code)}, message=${errorMsg}, txStatus=${tx?.status}, txId=${tx?.transactionId}`,
      );
      throw new BadRequestException(`Airtime purchase failed: ${errorMsg}`);
    } catch (error) {
      this.logger.error(
        `Airtime purchase exception: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.handleError('airtime purchase', error);
    }
  }

  async purchaseData(params: {
    serviceID: string;
    phone: string;
    variationCode: string;
  }): Promise<PurchaseResult> {
    const requestId = this.getRequestId();
    this.logger.log(
      `Initiating data purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, variationCode=${params.variationCode}`,
    );
    try {
      const payload = {
        request_id: requestId,
        serviceID: params.serviceID,
        phone: params.phone,
        variation_code: params.variationCode,
      };
      this.logger.debug(`VTpass data payload: ${JSON.stringify(payload)}`);
      const response = await this.client.post<VTPassResponse>('pay', payload, {
        headers: this.getAuthHeaders('POST'),
      });
      const data = response.data;
      this.logger.log(`VTpass data response: ${JSON.stringify(data)}`);
      const responseDescription = String(data.response_description ?? '');
      const isSuccessDescription =
        responseDescription === '000' || responseDescription === '0';
      if (!this.isSuccessCode(data.code) && !isSuccessDescription) {
        const errorMsg =
          responseDescription || data.message || 'VTpass data purchase failed';
        this.logger.error(
          `VTpass data failed: code=${String(data.code)}, message=${errorMsg}`,
        );
        throw new BadRequestException(`Data purchase failed: ${errorMsg}`);
      }
      const result = this.toPurchaseResult(requestId, data);
      this.logger.log(
        `Data purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Data purchase exception: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.handleError('data purchase', error);
    }
  }

  async purchaseCable(params: {
    serviceID: string;
    billersCode: string;
    amount: number;
    phone: string;
    variationCode?: string;
  }): Promise<PurchaseResult> {
    const requestId = this.getRequestId();
    this.logger.log(
      `Initiating cable purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${params.amount}, variationCode=${params.variationCode}`,
    );
    try {
      const payload = {
        request_id: requestId,
        serviceID: params.serviceID,
        billersCode: params.billersCode,
        amount: params.amount,
        phone: params.phone,
        subscription_type: 'renew',
        variation_code: params.variationCode,
      };
      this.logger.debug(`VTpass cable payload: ${JSON.stringify(payload)}`);
      const response = await this.client.post<VTPassResponse>('pay', payload, {
        headers: this.getAuthHeaders('POST'),
      });

      const data = response.data;
      this.logger.log(`VTpass cable response: ${JSON.stringify(data)}`);
      if (!this.isSuccessCode(data.code)) {
        const errorMsg =
          data.response_description ||
          data.message ||
          'VTpass cable purchase failed';
        this.logger.error(
          `VTpass cable failed: code=${String(data.code)}, message=${errorMsg}`,
        );
        throw new BadRequestException(`Cable purchase failed: ${errorMsg}`);
      }

      const result = this.toPurchaseResult(requestId, data);
      this.logger.log(
        `Cable purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Cable purchase exception: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.handleError('cable purchase', error);
    }
  }

  async purchaseElectricity(params: {
    serviceID: string;
    billersCode: string;
    amount: number;
    phone: string;
    variationCode: string;
  }): Promise<PurchaseResult> {
    const requestId = this.getRequestId();
    this.logger.log(
      `Initiating electricity purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${params.amount}, variationCode=${params.variationCode}`,
    );
    try {
      const payload = {
        request_id: requestId,
        serviceID: params.serviceID,
        billersCode: params.billersCode,
        amount: params.amount,
        phone: params.phone,
        variation_code: params.variationCode,
      };
      this.logger.debug(
        `VTpass electricity payload: ${JSON.stringify(payload)}`,
      );
      const response = await this.client.post<VTPassResponse>('pay', payload, {
        headers: this.getAuthHeaders('POST'),
      });

      const data = response.data;
      this.logger.log(`VTpass electricity response: ${JSON.stringify(data)}`);
      if (!this.isSuccessCode(data.code)) {
        const errorMsg =
          data.response_description ||
          data.message ||
          'VTpass electricity purchase failed';
        this.logger.error(
          `VTpass electricity failed: code=${String(data.code)}, message=${errorMsg}`,
        );
        throw new BadRequestException(
          `Electricity purchase failed: ${errorMsg}`,
        );
      }

      const result = this.toPurchaseResult(requestId, data);
      this.logger.log(
        `Electricity purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `Electricity purchase exception: ${error instanceof Error ? error.message : String(error)}`,
      );
      return this.handleError('electricity purchase', error);
    }
  }

  async verifyProduct(params: {
    serviceID: string;
    billersCode: string;
  }): Promise<VerifyProductResult> {
    const requestId = this.getRequestId();
    try {
      const response = await this.client.post<VTPassResponse>(
        'merchant-verify',
        {
          request_id: requestId,
          serviceID: params.serviceID,
          billersCode: params.billersCode,
        },
        { headers: this.getAuthHeaders('POST') },
      );

      const data = response.data;
      if (!this.isSuccessCode(data.code)) {
        return {
          valid: false,
          message: data.response_description || 'Verification failed',
        };
      }

      const tx = data.content?.transactions ?? {};
      const content = data.content ?? {};
      return {
        valid: true,
        name:
          tx.customer_name ??
          tx.name ??
          content.customer_name ??
          content.name ??
          undefined,
        address:
          tx.customer_address ??
          tx.address ??
          content.customer_address ??
          content.address ??
          undefined,
        packageInfo:
          tx.product_name ??
          tx.current_package ??
          content.product_name ??
          content.current_package ??
          undefined,
        outstanding:
          tx.outstanding_balance !== undefined
            ? Number(tx.outstanding_balance)
            : content.outstanding_balance !== undefined
              ? Number(content.outstanding_balance)
              : undefined,
        message: data.response_description,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 400) {
        const data = error.response.data as
          | { response_description?: string }
          | undefined;
        return {
          valid: false,
          message: data?.response_description ?? 'Verification failed',
        };
      }
      return this.handleError('product verification', error);
    }
  }

  async getServiceVariations(serviceID: string): Promise<ServiceVariation[]> {
    try {
      const response = await this.client.get<VTPassResponse>(
        'service-variations',
        {
          params: { serviceID },
          headers: this.getAuthHeaders('GET'),
        },
      );

      const data = response.data;
      const responseDescription = String(data.response_description ?? '');
      this.logger.log(
        `VTpass service-variations raw response code=${String(data.code)}, description=${responseDescription}`,
      );
      const isSuccessDescription =
        responseDescription === '000' || responseDescription === '0';
      if (!this.isSuccessCode(data.code) && !isSuccessDescription) {
        throw new BadRequestException(
          responseDescription || 'Failed to fetch variations',
        );
      }

      const variations = data.content?.variations ?? [];
      return variations.map((v) => ({
        variationCode: String(v.variation_code),
        name: String(v.name),
        amount: Number(v.variation_amount),
        fixedPrice: String(v.fixedPrice) === 'Yes',
      }));
    } catch (error) {
      return this.handleError('service variations', error);
    }
  }

  async queryTransaction(requestId: string): Promise<QueryTransactionResult> {
    try {
      const response = await this.client.post<VTPassResponse>(
        'requery',
        { request_id: requestId },
        { headers: this.getAuthHeaders('POST') },
      );

      const data = response.data;
      const tx = data.content?.transactions ?? {};
      return {
        status: tx.status ?? 'unknown',
        externalTransactionId: tx.transactionId,
      };
    } catch (error) {
      return this.handleError('transaction query', error);
    }
  }
}
