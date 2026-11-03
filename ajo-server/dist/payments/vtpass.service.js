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
const DEFAULT_BASE_URL = 'https://vtpass.com/api/';
const SUCCESS_CODES = new Set(['000', '0']);
const INVALID_CREDENTIALS_CODE = '087';
const TRANSIENT_CODES = new Set(['016', '017']);
const DELIVERED_STATUSES = new Set(['delivered', 'success', 'successful']);
const TOKEN_REQUERY_ATTEMPTS = 3;
const TOKEN_REQUERY_DELAY_MS = 2_000;
const REQUIRED_ENV = [
    'VTPASS_API_KEY',
    'VTPASS_PUBLIC_KEY',
    'VTPASS_SECRET_KEY',
];
function fieldKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}
function flattenFields(...sources) {
    const flat = new Map();
    for (const source of sources) {
        for (const [key, value] of Object.entries(source ?? {})) {
            if (value === null || value === undefined)
                continue;
            flat.set(fieldKey(key), value);
        }
    }
    return flat;
}
function pickText(flat, ...keys) {
    for (const key of keys) {
        const value = flat.get(fieldKey(key));
        if (typeof value === 'string' && value.trim())
            return value.trim();
        if (typeof value === 'number')
            return String(value);
    }
    return undefined;
}
function pickAmount(flat, ...keys) {
    const text = pickText(flat, ...keys);
    if (text === undefined)
        return undefined;
    const amount = Number(text.replace(/,/g, ''));
    return Number.isFinite(amount) ? amount : undefined;
}
function isPlaceholder(value) {
    return /^(n\/?a|nil|none|null|-)$/i.test(value.trim());
}
function readText(value) {
    if (typeof value === 'number')
        return String(value);
    if (typeof value !== 'string')
        return undefined;
    const text = value.trim();
    return text && !isPlaceholder(text) ? text : undefined;
}
function readToken(value) {
    if (typeof value === 'number')
        return String(value);
    if (typeof value !== 'string')
        return undefined;
    const token = value.replace(/^\s*token\s*[:-]?\s*/i, '').trim();
    return token && !isPlaceholder(token) ? token : undefined;
}
function readUnits(value) {
    if (typeof value === 'number')
        return String(value);
    if (typeof value !== 'string')
        return undefined;
    const units = value.replace(/\s*kwh\s*$/i, '').trim();
    return units && !isPlaceholder(units) ? units : undefined;
}
let VTPassService = VTPassService_1 = class VTPassService {
    configService;
    logger = new common_1.Logger(VTPassService_1.name);
    client;
    apiKey;
    publicKey;
    secretKey;
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.readKey('VTPASS_API_KEY');
        this.publicKey = this.readKey('VTPASS_PUBLIC_KEY');
        this.secretKey = this.readKey('VTPASS_SECRET_KEY');
        const baseURL = this.configService.get('VTPASS_BASE_URL')?.trim() ||
            DEFAULT_BASE_URL;
        this.client = axios_1.default.create({
            baseURL: baseURL.endsWith('/') ? baseURL : `${baseURL}/`,
            timeout: 60_000,
            headers: { 'Content-Type': 'application/json' },
        });
        const missing = this.missingConfig();
        if (missing.length > 0) {
            this.logger.warn(`VTpass is not configured — missing ${missing.join(', ')}. Bill purchases will answer 503 until the key pair is set in ajo-server/.env.`);
        }
    }
    isConfigured() {
        return this.missingConfig().length === 0;
    }
    missingConfig() {
        return REQUIRED_ENV.filter((key) => !this.readKey(key));
    }
    readKey(name) {
        const value = this.configService.get(name);
        const trimmed = typeof value === 'string' ? value.trim() : '';
        return trimmed ? trimmed : undefined;
    }
    assertConfigured() {
        const missing = this.missingConfig();
        if (missing.length === 0)
            return;
        throw new common_1.ServiceUnavailableException(`Bill payments are not configured on this server: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing. Add the VTpass key pair to ajo-server/.env and restart the server.`);
    }
    authHeaders(method) {
        const headers = {};
        if (this.apiKey)
            headers['api-key'] = this.apiKey;
        const authKey = method === 'GET' ? this.publicKey : this.secretKey;
        if (authKey) {
            headers[method === 'GET' ? 'public-key' : 'secret-key'] = authKey;
        }
        return headers;
    }
    getRequestId() {
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        const stamp = `${now.getFullYear()}` +
            pad(now.getMonth() + 1) +
            pad(now.getDate()) +
            pad(now.getHours()) +
            pad(now.getMinutes());
        return `${stamp}${(0, crypto_1.randomUUID)().replace(/-/g, '').slice(0, 12)}`;
    }
    isSuccessResponse(data) {
        const code = String(data.code ?? '').trim();
        const description = String(data.response_description ?? '').trim();
        const codeOk = SUCCESS_CODES.has(code) ||
            (code === '' && SUCCESS_CODES.has(description));
        if (!codeOk)
            return false;
        const content = data.content ?? {};
        if (content.WrongBillersCode === true)
            return false;
        const status = String(content.transactions?.status ?? '').toLowerCase();
        return status !== 'failed' && status !== 'reversed';
    }
    isDelivered(data) {
        const status = String(data?.content?.transactions?.status ?? '').toLowerCase();
        return DELIVERED_STATUSES.has(status);
    }
    describeFailure(data) {
        const candidates = [
            data.content?.error,
            data.message,
            data.response_description,
        ];
        for (const candidate of candidates) {
            const text = typeof candidate === 'string' ? candidate.trim() : '';
            if (text && !SUCCESS_CODES.has(text))
                return text;
        }
        return 'VTpass did not confirm this transaction';
    }
    toFailureException(label, data, requestId) {
        const code = String(data.code ?? '').trim();
        const reason = this.describeFailure(data);
        const ref = requestId ? ` (ref ${requestId})` : '';
        if (code === INVALID_CREDENTIALS_CODE) {
            return new common_1.ServiceUnavailableException('Bill payments are unavailable: VTpass rejected the server credentials (087 INVALID CREDENTIALS). Update VTPASS_API_KEY / VTPASS_PUBLIC_KEY / VTPASS_SECRET_KEY and restart the server.');
        }
        if (TRANSIENT_CODES.has(code)) {
            return new common_1.ServiceUnavailableException(`${label} purchase could not be completed right now (VTpass ${code}: ${reason})${ref}. You were not charged — please try again in a moment.`);
        }
        return new common_1.BadRequestException(`${label} purchase failed: ${reason}${ref}`);
    }
    handleError(action, error, requestId) {
        const ref = requestId ? ` (ref ${requestId})` : '';
        if (axios_1.default.isAxiosError(error)) {
            const status = error.response?.status;
            const body = error.response?.data;
            this.logger.error(`VTpass ${action} failed: status=${status}, body=${JSON.stringify(body)}`);
            if (body && typeof body === 'object') {
                if (String(body.code ?? '').trim() === INVALID_CREDENTIALS_CODE) {
                    throw this.toFailureException(action, body, requestId);
                }
                const message = this.describeFailure(body);
                if (status && status >= 400 && status < 500) {
                    throw new common_1.BadRequestException(`VTpass ${action} failed: ${message}${ref}`);
                }
                throw new common_1.ServiceUnavailableException(`VTpass ${action} is temporarily unavailable${ref}: ${message}`);
            }
            throw new common_1.ServiceUnavailableException(`VTpass ${action} is temporarily unavailable${ref}: ${error.message}`);
        }
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`VTpass ${action} failed: ${message}`);
        throw new common_1.ServiceUnavailableException(`VTpass ${action} is temporarily unavailable${ref}: ${message}`);
    }
    toPurchaseResult(requestId, data) {
        const content = data.content ?? {};
        const tx = content.transactions;
        const providerData = {};
        const add = (key, ...values) => {
            for (const value of values) {
                if (value !== undefined && value !== null && value !== '') {
                    providerData[key] = value;
                    return;
                }
            }
        };
        add('token', readToken(tx?.token), readToken(content.token), readToken(data.token), readToken(tx?.main_token), readToken(content.main_token), readToken(data.main_token), readToken(tx?.mainToken), readToken(content.mainToken), readToken(data.mainToken), readToken(tx?.extras), readToken(content.extras), readToken(tx?.purchased_code), readToken(content.purchased_code), readToken(data.purchased_code));
        add('units', readUnits(tx?.units), readUnits(content.units), readUnits(data.units));
        add('discoName', readText(tx?.disco_name), readText(content.disco_name));
        add('customerName', readText(tx?.customer_name), readText(tx?.name), readText(content.customer_name), readText(content.name), readText(data.customerName));
        add('customerAddress', readText(tx?.customer_address), readText(tx?.address), readText(content.customer_address), readText(content.address), readText(data.customerAddress));
        add('packageName', readText(tx?.product_name), readText(tx?.current_package), readText(content.product_name), readText(content.current_package));
        add('outstanding', tx?.outstanding_balance, content.outstanding_balance);
        return {
            requestId,
            externalTransactionId: tx?.transactionId ?? requestId,
            status: tx?.status ?? 'delivered',
            commission: Number(tx?.commission ?? 0) || 0,
            ...(Object.keys(providerData).length > 0 ? { providerData } : {}),
        };
    }
    async submitPurchase(action, label, payload) {
        const requestId = String(payload.request_id);
        let data;
        try {
            const response = await this.client.post('pay', payload, {
                headers: this.authHeaders('POST'),
            });
            data = response.data ?? { code: '' };
            this.logger.log(`VTpass ${action} response: ${JSON.stringify(data)}`);
        }
        catch (error) {
            const requery = await this.fetchRequery(requestId);
            if (this.isDelivered(requery)) {
                this.logger.warn(`VTpass ${action} threw (${error instanceof Error ? error.message : String(error)}) but requery confirms delivery — treating as success`);
                return this.toPurchaseResult(requestId, requery ?? { code: '000' });
            }
            return this.handleError(`${label} purchase`, error, requestId);
        }
        if (this.isSuccessResponse(data)) {
            const result = this.toPurchaseResult(requestId, data);
            this.logger.log(`${label} purchase successful: requestId=${requestId}, transactionId=${result.externalTransactionId}, commission=${result.commission}`);
            return result;
        }
        this.logger.warn(`VTpass ${action} not confirmed (code=${String(data.code)}, reason=${this.describeFailure(data)}) — requerying ${requestId}`);
        const requery = await this.fetchRequery(requestId);
        if (this.isDelivered(requery)) {
            const result = this.toPurchaseResult(requestId, requery ?? data);
            this.logger.warn(`${label} purchase confirmed by requery: requestId=${requestId}, transactionId=${result.externalTransactionId}`);
            return result;
        }
        this.logger.error(`${label} purchase failed: requestId=${requestId}, response=${JSON.stringify(data)}`);
        throw this.toFailureException(label, data, requestId);
    }
    async fetchRequery(requestId) {
        try {
            const response = await this.client.post('requery', { request_id: requestId }, { headers: this.authHeaders('POST') });
            this.logger.log(`VTpass requery ${requestId}: ${JSON.stringify(response.data)}`);
            return response.data ?? null;
        }
        catch (error) {
            this.logger.warn(`VTpass requery failed for ${requestId}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async requeryForToken(requestId, result) {
        const merged = { ...(result.providerData ?? {}) };
        for (let attempt = 1; attempt <= TOKEN_REQUERY_ATTEMPTS; attempt++) {
            if (attempt > 1) {
                await new Promise((resolve) => setTimeout(resolve, TOKEN_REQUERY_DELAY_MS));
            }
            const requery = await this.fetchRequery(requestId);
            if (!requery)
                continue;
            const extra = this.toPurchaseResult(requestId, requery).providerData ?? {};
            for (const [key, value] of Object.entries(extra)) {
                const current = merged[key];
                if (current === undefined || current === '')
                    merged[key] = value;
            }
            if (merged.token) {
                this.logger.log(`Electricity token recovered on requery ${requestId} (attempt ${attempt}): units=${readText(merged.units) ?? '—'}`);
                return { ...result, providerData: merged };
            }
        }
        this.logger.warn(`Electricity vend ${requestId} is delivered but still has no token after ${TOKEN_REQUERY_ATTEMPTS} requeries — the member may need the token resent by VTpass support`);
        return { ...result, providerData: merged };
    }
    async purchaseAirtime(params) {
        this.assertConfigured();
        const amount = Math.round(params.amount);
        if (amount < 50) {
            throw new common_1.BadRequestException('Airtime purchases start at ₦50');
        }
        const requestId = this.getRequestId();
        this.logger.log(`Initiating airtime purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, amount=${amount}`);
        return this.submitPurchase('airtime', 'Airtime', {
            request_id: requestId,
            serviceID: params.serviceID,
            amount,
            phone: params.phone,
        });
    }
    async purchaseData(params) {
        this.assertConfigured();
        if (!params.variationCode) {
            throw new common_1.BadRequestException('A data plan must be selected');
        }
        const requestId = this.getRequestId();
        this.logger.log(`Initiating data purchase: requestId=${requestId}, serviceID=${params.serviceID}, phone=${params.phone}, variationCode=${params.variationCode}`);
        return this.submitPurchase('data', 'Data', {
            request_id: requestId,
            serviceID: params.serviceID,
            phone: params.phone,
            variation_code: params.variationCode,
        });
    }
    async purchaseCable(params) {
        this.assertConfigured();
        if (!params.variationCode && !params.renewCurrentBouquet) {
            throw new common_1.BadRequestException('A cable/bouquet plan must be selected');
        }
        const requestId = this.getRequestId();
        const amount = Math.round(params.amount);
        this.logger.log(`Initiating cable purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${amount}, variationCode=${params.variationCode ?? '(current bouquet)'}`);
        const payload = {
            request_id: requestId,
            serviceID: params.serviceID,
            billersCode: params.billersCode,
            amount,
            phone: params.phone,
            subscription_type: 'renew',
        };
        if (params.variationCode)
            payload.variation_code = params.variationCode;
        return this.submitPurchase('cable', 'Cable', payload);
    }
    async purchaseElectricity(params) {
        this.assertConfigured();
        const amount = Math.round(params.amount);
        if (amount < 500) {
            throw new common_1.BadRequestException('Electricity payments start at ₦500');
        }
        const meter = await this.verifyProduct({
            serviceID: params.serviceID,
            billersCode: params.billersCode,
        });
        if (!meter.valid) {
            throw new common_1.BadRequestException(meter.message || 'Meter number could not be verified');
        }
        const requestId = this.getRequestId();
        this.logger.log(`Initiating electricity purchase: requestId=${requestId}, serviceID=${params.serviceID}, billersCode=${params.billersCode}, amount=${amount}, variationCode=${params.variationCode}`);
        const result = await this.submitPurchase('electricity', 'Electricity', {
            request_id: requestId,
            serviceID: params.serviceID,
            billersCode: params.billersCode,
            variation_code: params.variationCode,
            amount,
            phone: params.phone,
        });
        const vendResult = params.variationCode === 'prepaid' && !result.providerData?.token
            ? await this.requeryForToken(requestId, result)
            : result;
        const details = vendResult.providerData ?? {};
        if (!details.customerName && meter.name) {
            return {
                ...vendResult,
                providerData: { ...details, customerName: meter.name },
            };
        }
        return vendResult;
    }
    async verifyProduct(params) {
        this.assertConfigured();
        const requestId = this.getRequestId();
        let data;
        try {
            const response = await this.client.post('merchant-verify', {
                request_id: requestId,
                serviceID: params.serviceID,
                billersCode: params.billersCode,
            }, { headers: this.authHeaders('POST') });
            data = response.data ?? { code: '' };
            this.logger.log(`VTpass merchant-verify ${params.serviceID}/${params.billersCode}: ${JSON.stringify(data)}`);
        }
        catch (error) {
            if (axios_1.default.isAxiosError(error) && error.response?.status === 400) {
                const body = error.response.data;
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
        const flat = flattenFields(content, tx);
        const name = pickText(flat, 'customer_name', 'name');
        if (!name) {
            return { valid: false, message: 'Customer details could not be found' };
        }
        return {
            valid: true,
            name,
            address: pickText(flat, 'customer_address', 'address'),
            packageInfo: pickText(flat, 'current_bouquet', 'current_package', 'product_name'),
            outstanding: pickAmount(flat, 'renewal_amount', 'outstanding_balance'),
            message: data.response_description,
        };
    }
    async getServiceVariations(serviceID) {
        try {
            const response = await this.client.get('service-variations', {
                params: { serviceID },
                headers: this.authHeaders('GET'),
            });
            const data = response.data ?? { code: '' };
            this.logger.log(`VTpass service-variations ${serviceID}: code=${String(data.code)}, description=${String(data.response_description ?? '')}`);
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
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException ||
                error instanceof common_1.ServiceUnavailableException) {
                throw error;
            }
            return this.handleError('service variations', error);
        }
    }
    async queryTransaction(requestId) {
        this.assertConfigured();
        const data = await this.fetchRequery(requestId);
        const tx = data?.content?.transactions ?? {};
        return {
            status: tx.status ?? 'unknown',
            externalTransactionId: tx.transactionId,
        };
    }
};
exports.VTPassService = VTPassService;
exports.VTPassService = VTPassService = VTPassService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], VTPassService);
//# sourceMappingURL=vtpass.service.js.map