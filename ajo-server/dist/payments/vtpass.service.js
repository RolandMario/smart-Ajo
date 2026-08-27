"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var VTPassService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VTPassService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
let VTPassService = VTPassService_1 = class VTPassService {
    configService;
    logger = new common_1.Logger(VTPassService_1.name);
    client;
    apiKey;
    publicKey;
    secretKey;
    baseURL;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('VTPASS_API_KEY');
        this.publicKey = this.configService.get('VTPASS_PUBLIC_KEY');
        this.secretKey = this.configService.get('VTPASS_SECRET_KEY');
        this.baseURL = this.configService.get('VTPASS_BASE_URL');
        this.client = axios_1.default.create({
            baseURL: this.baseURL,
            headers: {
                'Content-Type': 'application/json',
                'api-key': this.apiKey,
            },
        });
    }
    getAuthHeaders(method) {
        if (method === 'GET') {
            return { 'public-key': this.publicKey };
        }
        return { 'secret-key': this.secretKey };
    }
    getRequestId() {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mi = String(now.getMinutes()).padStart(2, '0');
        const datePrefix = `${yyyy}${mm}${dd}${hh}${mi}`;
        const suffix = (0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 16);
        return `${datePrefix}${suffix}`;
    }
    isSuccessCode(code) {
        const codeStr = typeof code === 'number' ? String(code) : String(code ?? '');
        return codeStr === '000' || codeStr === '0';
    }
    handleError(action, error) {
        if (axios_1.default.isAxiosError(error)) {
            const status = error.response?.status;
            const respData = error.response?.data;
            this.logger.error(`VTpass ${action} failed: status=${status}, body=${JSON.stringify(respData)}`);
            const data = respData;
            const message = data?.response_description ?? data?.message ?? error.message;
            if (error.response &&
                error.response.status >= 400 &&
                error.response.status < 500) {
                throw new common_1.BadRequestException(`VTpass error: ${message}`);
            }
        }
        else if (error instanceof Error) {
            this.logger.error(`VTpass ${action} failed: ${error.message}`);
            throw new common_1.InternalServerErrorException(`VTpass ${action} failed: ${error.message}`);
        }
        else {
            this.logger.error(`VTpass ${action} failed: ${String(error)}`);
        }
        throw new common_1.InternalServerErrorException(`VTpass ${action} failed`);
    }
    toPurchaseResult(requestId, data) {
        const tx = data.content?.transactions;
        const content = data.content ?? {};
        const providerData = {};
        const add = (key, ...values) => {
            for (const value of values) {
                if (value !== undefined && value !== null && value !== '') {
                    providerData[key] = value;
                    return;
                }
            }
        };
        add('token', tx?.token, content.token, tx?.main_token, content.main_token, tx?.mainToken, content.mainToken);
        add('units', tx?.units, content.units);
        add('discoName', tx?.disco_name, content.disco_name);
        add('customerName', tx?.customer_name, tx?.name, content.customer_name, content.name);
        add('customerAddress', tx?.customer_address, tx?.address, content.customer_address, content.address);
        add('packageName', tx?.product_name, tx?.current_package, content.product_name, content.current_package);
        add('outstanding', tx?.outstanding_balance, content.outstanding_balance);
        return {
            requestId,
            externalTransactionId: tx?.transactionId ?? requestId,
            status: tx?.status ?? 'delivered',
            commission: Number(tx?.commission ?? 0),
            ...(Object.keys(providerData).length > 0 ? { providerData } : {}),
        };
    }
    async purchaseAirtime(params) {
        const requestId = this.getRequestId();
        this.logger.log(`Initiating airtime purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, amount=${params.amount}`);
        try {
            const payload = {
                request_id: requestId,
                serviceID: params.serviceID,
                amount: params.amount,
                phone: params.phone,
            };
            this.logger.debug(`VTpass airtime payload: ${JSON.stringify(payload)}`);
            const response = await this.client.post('pay', payload, {
                headers: this.getAuthHeaders('POST'),
            });
            const data = response.data;
            this.logger.log(`VTpass airtime response: ${JSON.stringify(data)}`);
            const tx = data.content?.transactions;
            if (this.isSuccessCode(data.code) && tx?.status !== 'failed') {
                const result = this.toPurchaseResult(requestId, data);
                this.logger.log(`Airtime purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`);
                return result;
            }
            this.logger.log(`VTpass airtime not confirmed (code=${String(data.code)}, txStatus=${tx?.status}) — requerying requestId=${requestId}`);
            try {
                const qr = await this.queryTransaction(requestId);
                this.logger.log(`VTpass airtime requery result: ${JSON.stringify(qr)}`);
                if (qr.status === 'delivered' ||
                    qr.status === 'success' ||
                    qr.status === 'successful') {
                    const result = this.toPurchaseResult(requestId, data);
                    this.logger.log(`Airtime purchase confirmed on requery: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`);
                    return result;
                }
                this.logger.warn(`VTpass airtime requery did not confirm delivery — status=${qr.status}, txId=${qr.externalTransactionId}`);
            }
            catch (e) {
                this.logger.error(`VTpass airtime requery failed: ${e instanceof Error ? e.message : String(e)}`);
            }
            const errorMsg = data.response_description || data.message || 'VTpass purchase failed';
            this.logger.error(`VTpass airtime failed: code=${String(data.code)}, message=${errorMsg}, txStatus=${tx?.status}, txId=${tx?.transactionId}`);
            throw new common_1.BadRequestException(`Airtime purchase failed: ${errorMsg}`);
        }
        catch (error) {
            this.logger.error(`Airtime purchase exception: ${error instanceof Error ? error.message : String(error)}`);
            return this.handleError('airtime purchase', error);
        }
    }
    async purchaseData(params) {
        const requestId = this.getRequestId();
        this.logger.log(`Initiating data purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, variationCode=${params.variationCode}`);
        try {
            const payload = {
                request_id: requestId,
                serviceID: params.serviceID,
                phone: params.phone,
                variation_code: params.variationCode,
            };
            this.logger.debug(`VTpass data payload: ${JSON.stringify(payload)}`);
            const response = await this.client.post('pay', payload, {
                headers: this.getAuthHeaders('POST'),
            });
            const data = response.data;
            this.logger.log(`VTpass data response: ${JSON.stringify(data)}`);
            const responseDescription = String(data.response_description ?? '');
            const isSuccessDescription = responseDescription === '000' || responseDescription === '0';
            if (!this.isSuccessCode(data.code) && !isSuccessDescription) {
                const errorMsg = responseDescription || data.message || 'VTpass data purchase failed';
                this.logger.error(`VTpass data failed: code=${String(data.code)}, message=${errorMsg}`);
                throw new common_1.BadRequestException(`Data purchase failed: ${errorMsg}`);
            }
            const result = this.toPurchaseResult(requestId, data);
            this.logger.log(`Data purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Data purchase exception: ${error instanceof Error ? error.message : String(error)}`);
            return this.handleError('data purchase', error);
        }
    }
    async purchaseCable(params) {
        const requestId = this.getRequestId();
        this.logger.log(`Initiating cable purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${params.amount}, variationCode=${params.variationCode}`);
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
            const response = await this.client.post('pay', payload, {
                headers: this.getAuthHeaders('POST'),
            });
            const data = response.data;
            this.logger.log(`VTpass cable response: ${JSON.stringify(data)}`);
            if (!this.isSuccessCode(data.code)) {
                const errorMsg = data.response_description ||
                    data.message ||
                    'VTpass cable purchase failed';
                this.logger.error(`VTpass cable failed: code=${String(data.code)}, message=${errorMsg}`);
                throw new common_1.BadRequestException(`Cable purchase failed: ${errorMsg}`);
            }
            const result = this.toPurchaseResult(requestId, data);
            this.logger.log(`Cable purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Cable purchase exception: ${error instanceof Error ? error.message : String(error)}`);
            return this.handleError('cable purchase', error);
        }
    }
    async purchaseElectricity(params) {
        const requestId = this.getRequestId();
        this.logger.log(`Initiating electricity purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${params.amount}, variationCode=${params.variationCode}`);
        try {
            const payload = {
                request_id: requestId,
                serviceID: params.serviceID,
                billersCode: params.billersCode,
                amount: params.amount,
                phone: params.phone,
                variation_code: params.variationCode,
            };
            this.logger.debug(`VTpass electricity payload: ${JSON.stringify(payload)}`);
            const response = await this.client.post('pay', payload, {
                headers: this.getAuthHeaders('POST'),
            });
            const data = response.data;
            this.logger.log(`VTpass electricity response: ${JSON.stringify(data)}`);
            if (!this.isSuccessCode(data.code)) {
                const errorMsg = data.response_description ||
                    data.message ||
                    'VTpass electricity purchase failed';
                this.logger.error(`VTpass electricity failed: code=${String(data.code)}, message=${errorMsg}`);
                throw new common_1.BadRequestException(`Electricity purchase failed: ${errorMsg}`);
            }
            const result = this.toPurchaseResult(requestId, data);
            this.logger.log(`Electricity purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`);
            return result;
        }
        catch (error) {
            this.logger.error(`Electricity purchase exception: ${error instanceof Error ? error.message : String(error)}`);
            return this.handleError('electricity purchase', error);
        }
    }
    async verifyProduct(params) {
        const requestId = this.getRequestId();
        try {
            const response = await this.client.post('merchant-verify', {
                request_id: requestId,
                serviceID: params.serviceID,
                billersCode: params.billersCode,
            }, { headers: this.getAuthHeaders('POST') });
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
                name: tx.customer_name ??
                    tx.name ??
                    content.customer_name ??
                    content.name ??
                    undefined,
                address: tx.customer_address ??
                    tx.address ??
                    content.customer_address ??
                    content.address ??
                    undefined,
                packageInfo: tx.product_name ??
                    tx.current_package ??
                    content.product_name ??
                    content.current_package ??
                    undefined,
                outstanding: tx.outstanding_balance !== undefined
                    ? Number(tx.outstanding_balance)
                    : content.outstanding_balance !== undefined
                        ? Number(content.outstanding_balance)
                        : undefined,
                message: data.response_description,
            };
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 400) {
                const data = error.response.data;
                return {
                    valid: false,
                    message: data?.response_description ?? 'Verification failed',
                };
            }
            return this.handleError('product verification', error);
        }
    }
    async getServiceVariations(serviceID) {
        try {
            const response = await this.client.get('service-variations', {
                params: { serviceID },
                headers: this.getAuthHeaders('GET'),
            });
            const data = response.data;
            const responseDescription = String(data.response_description ?? '');
            this.logger.log(`VTpass service-variations raw response code=${String(data.code)}, description=${responseDescription}`);
            const isSuccessDescription = responseDescription === '000' || responseDescription === '0';
            if (!this.isSuccessCode(data.code) && !isSuccessDescription) {
                throw new common_1.BadRequestException(responseDescription || 'Failed to fetch variations');
            }
            const variations = data.content?.variations ?? [];
            return variations.map((v) => ({
                variationCode: String(v.variation_code),
                name: String(v.name),
                amount: Number(v.variation_amount),
                fixedPrice: String(v.fixedPrice) === 'Yes',
            }));
        }
        catch (error) {
            return this.handleError('service variations', error);
        }
    }
    async queryTransaction(requestId) {
        try {
            const response = await this.client.post('requery', { request_id: requestId }, { headers: this.getAuthHeaders('POST') });
            const data = response.data;
            const tx = data.content?.transactions ?? {};
            return {
                status: tx.status ?? 'unknown',
                externalTransactionId: tx.transactionId,
            };
        }
        catch (error) {
            return this.handleError('transaction query', error);
        }
    }
};
exports.VTPassService = VTPassService;
exports.VTPassService = VTPassService = VTPassService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], VTPassService);
//# sourceMappingURL=vtpass.service.js.map