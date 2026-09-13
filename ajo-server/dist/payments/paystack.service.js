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
var PaystackService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaystackService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
let PaystackService = PaystackService_1 = class PaystackService {
    configService;
    logger = new common_1.Logger(PaystackService_1.name);
    client;
    secretKey;
    DVA_BANK_POOL = [
        'wema',
        'providus',
        'sterling',
        'titan-paystack',
    ];
    constructor(configService) {
        this.configService = configService;
        this.secretKey = this.configService.get('PAYSTACK_SECRET_KEY');
        const baseURL = this.configService.get('PAYSTACK_BASE_URL');
        this.client = axios_1.default.create({
            baseURL,
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
            },
        });
    }
    handleError(action, error) {
        if (axios_1.default.isAxiosError(error)) {
            const message = error.response?.data?.message ??
                error.message;
            this.logger.error(`Paystack ${action} failed: ${message}`);
            if (error.response &&
                error.response.status >= 400 &&
                error.response.status < 500) {
                throw new common_1.BadRequestException(`Paystack error: ${message}`);
            }
        }
        else {
            this.logger.error(`Paystack ${action} failed: ${String(error)}`);
        }
        throw new common_1.InternalServerErrorException(`Paystack ${action} failed`);
    }
    async initializeTransaction(email, amountNaira, reference) {
        try {
            const response = await this.client.post('/transaction/initialize', {
                email,
                amount: Math.round(amountNaira * 100),
                reference,
            });
            const { authorization_url, access_code, reference: ref, } = response.data.data;
            return {
                authorizationUrl: authorization_url,
                accessCode: access_code,
                reference: ref,
            };
        }
        catch (error) {
            return this.handleError('transaction initialize', error);
        }
    }
    async verifyTransaction(reference) {
        try {
            const response = await this.client.get(`/transaction/verify/${encodeURIComponent(reference)}`);
            const data = response.data.data;
            return {
                status: data.status,
                reference: data.reference,
                amount: data.amount,
                currency: data.currency,
                paidAt: data.paid_at,
            };
        }
        catch (error) {
            return this.handleError('transaction verify', error);
        }
    }
    async listBanks() {
        try {
            const response = await this.client.get('/bank', {
                params: { country: 'nigeria', currency: 'NGN' },
            });
            return response.data.data.map((bank) => ({
                name: bank.name,
                code: bank.code,
            }));
        }
        catch (error) {
            return this.handleError('bank list', error);
        }
    }
    async resolveAccountNumber(accountNumber, bankCode) {
        try {
            const response = await this.client.get('/bank/resolve', {
                params: { account_number: accountNumber, bank_code: bankCode },
            });
            const data = response.data.data;
            return {
                accountNumber: data.account_number,
                accountName: data.account_name,
            };
        }
        catch (error) {
            return this.handleError('account resolution', error);
        }
    }
    async createTransferRecipient(params) {
        try {
            const response = await this.client.post('/transferrecipient', {
                type: 'nuban',
                name: params.accountName,
                account_number: params.accountNumber,
                bank_code: params.bankCode,
                currency: 'NGN',
            });
            return { recipientCode: response.data.data.recipient_code };
        }
        catch (error) {
            return this.handleError('transfer recipient creation', error);
        }
    }
    async createCustomer(params) {
        try {
            const body = { phone: params.phone };
            if (params.email)
                body.email = params.email;
            if (params.firstName)
                body.first_name = params.firstName;
            if (params.lastName)
                body.last_name = params.lastName;
            const response = await this.client.post('/customer', body);
            return { customerCode: response.data.data.customer_code };
        }
        catch (error) {
            return this.handleError('customer creation', error);
        }
    }
    dvaPreferredBank() {
        return (this.configService.get('PAYSTACK_DVA_PREFERRED_BANK') ?? 'wema');
    }
    dvaBankCandidates() {
        const preferred = this.dvaPreferredBank().trim().toLowerCase();
        return [preferred, ...this.DVA_BANK_POOL.filter((bank) => bank !== preferred)];
    }
    isDvaBankUnavailableError(error) {
        const message = error instanceof Error ? error.message : String(error);
        return /is not available in test mode|bank is not (?:available|supported)/i.test(message);
    }
    async createDedicatedAccount(params) {
        const banks = this.dvaBankCandidates();
        let lastError;
        for (const bank of banks) {
            try {
                return await this.requestDedicatedAccount({ ...params, preferredBank: bank });
            }
            catch (err) {
                lastError = err;
                if (!this.isDvaBankUnavailableError(err)) {
                    throw err;
                }
            }
        }
        throw lastError;
    }
    async requestDedicatedAccount(params) {
        try {
            const response = await this.client.post('/dedicated_account', {
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
        }
        catch (error) {
            return this.handleError('dedicated account creation', error);
        }
    }
    async fetchDedicatedAccounts(customerCode) {
        try {
            const response = await this.client.get('/dedicated_account', {
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
        }
        catch (error) {
            return this.handleError('dedicated account fetch', error);
        }
    }
    async deactivateDedicatedAccount(accountId) {
        try {
            await this.client.post(`/dedicated_account/${encodeURIComponent(accountId)}/deactivate`, {});
        }
        catch (error) {
            this.handleError('dedicated account deactivation', error);
        }
    }
    async initiateTransfer(params) {
        try {
            const response = await this.client.post('/transfer', {
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
        }
        catch (error) {
            return this.handleError('transfer initiation', error);
        }
    }
    isTestMode() {
        return this.secretKey.startsWith('sk_test_');
    }
    testTransferOtp() {
        return this.configService.get('PAYSTACK_TRANSFER_OTP') ?? '123456';
    }
    async resolveOtp(transferCode, otp) {
        try {
            const response = await this.client.post('/transfer/finalize_transfer', {
                transfer_code: transferCode,
                otp,
            });
            return { status: response.data.data.status };
        }
        catch (error) {
            return this.handleError('transfer OTP resolution', error);
        }
    }
    verifyWebhookSignature(rawBody, signatureHeader) {
        if (!signatureHeader) {
            return false;
        }
        const expected = (0, crypto_1.createHmac)('sha512', this.secretKey)
            .update(rawBody)
            .digest('hex');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        const actualBuffer = Buffer.from(signatureHeader, 'utf8');
        if (expectedBuffer.length !== actualBuffer.length) {
            return false;
        }
        return (0, crypto_1.timingSafeEqual)(expectedBuffer, actualBuffer);
    }
};
exports.PaystackService = PaystackService;
exports.PaystackService = PaystackService = PaystackService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], PaystackService);
//# sourceMappingURL=paystack.service.js.map