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
exports.PaystackService = exports.PAYSTACK_NOT_CONFIGURED_MESSAGE = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
exports.PAYSTACK_NOT_CONFIGURED_MESSAGE = 'Payments are not configured on this server: PAYSTACK_SECRET_KEY is missing or invalid. ' +
    'Set it to a valid Paystack secret key (sk_test_… for test mode, sk_live_… for live) and restart the server.';
const PAYSTACK_PLACEHOLDER_PATTERN = /your[-_ ]?paystack|placeholder|changeme|replace[-_ ]?me|undefined|null|xxx+/i;
let PaystackService = PaystackService_1 = class PaystackService {
    configService;
    logger = new common_1.Logger(PaystackService_1.name);
    client;
    secretKey;
    DVA_BANK_POOL = [
        'wema-bank',
        'titan-paystack',
        'wema',
        'providus',
        'sterling',
    ];
    providerCache;
    constructor(configService) {
        this.configService = configService;
        this.secretKey = this.normalizeSecret(this.configService.get('PAYSTACK_SECRET_KEY'));
        const baseURL = this.configService.get('PAYSTACK_BASE_URL')?.trim() ||
            'https://api.paystack.co';
        this.client = axios_1.default.create({
            baseURL,
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
            },
        });
        if (!this.isConfigured()) {
            this.logger.warn('PAYSTACK_SECRET_KEY is missing or a placeholder — wallet funding, ' +
                'virtual accounts, savings withdrawals and group payouts will fail ' +
                'with a 503 until a valid key is configured (see PAYSTACK_NOT_CONFIGURED_MESSAGE).');
        }
    }
    normalizeSecret(value) {
        if (!value)
            return '';
        return value
            .trim()
            .replace(/^["'`]+/, '')
            .replace(/["'`]+$/, '')
            .trim();
    }
    isConfigured() {
        if (!this.secretKey.startsWith('sk_'))
            return false;
        if (this.secretKey.length < 20)
            return false;
        return !PAYSTACK_PLACEHOLDER_PATTERN.test(this.secretKey);
    }
    assertConfigured() {
        if (this.isConfigured())
            return;
        throw new common_1.ServiceUnavailableException(exports.PAYSTACK_NOT_CONFIGURED_MESSAGE);
    }
    isInvalidKeyError(error) {
        if (!axios_1.default.isAxiosError(error))
            return false;
        if (error.response?.status !== 401)
            return false;
        const data = error.response.data;
        const message = (data?.message ?? '').toLowerCase();
        return data?.code === 'invalid_Key' || message.includes('invalid key');
    }
    errorMessage(error) {
        if (axios_1.default.isAxiosError(error)) {
            const data = error.response?.data;
            return data?.message ?? error.message;
        }
        return error instanceof Error ? error.message : String(error);
    }
    isCustomerNotFoundError(error) {
        return /customer (?:not found|does not exist)|customer_not_found/i.test(this.errorMessage(error));
    }
    isDuplicateCustomerError(error) {
        return /customer (?:already )?exists|already (?:exists|been taken)|duplicate/i.test(this.errorMessage(error));
    }
    isDedicatedAccountExistsError(error) {
        return /already (?:has|have) (?:a )?dedicated account|dedicated account (?:already )?(?:exists|assigned)/i.test(this.errorMessage(error));
    }
    handleError(action, error) {
        if (axios_1.default.isAxiosError(error)) {
            const message = error.response?.data?.message ??
                error.message;
            this.logger.error(`Paystack ${action} failed: ${message}`);
            if (this.isInvalidKeyError(error)) {
                this.logger.error(exports.PAYSTACK_NOT_CONFIGURED_MESSAGE);
                throw new common_1.ServiceUnavailableException(exports.PAYSTACK_NOT_CONFIGURED_MESSAGE);
            }
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
            const body = {};
            if (params.phone)
                body.phone = params.phone;
            if (params.email)
                body.email = params.email;
            if (params.firstName)
                body.first_name = params.firstName;
            if (params.lastName)
                body.last_name = params.lastName;
            if (params.metadata)
                body.metadata = params.metadata;
            const response = await this.client.post('/customer', body);
            return { customerCode: response.data.data.customer_code };
        }
        catch (error) {
            return this.handleError('customer creation', error);
        }
    }
    async fetchCustomer(customerCode) {
        try {
            const response = await this.client.get(`/customer/${encodeURIComponent(customerCode)}`);
            const data = response.data?.data ?? {};
            return {
                customerCode: data.customer_code ?? customerCode,
                email: data.email,
                phone: data.phone,
            };
        }
        catch (error) {
            if (this.isCustomerNotFoundError(error)) {
                this.logger.warn(`Paystack customer ${customerCode} not found in this mode — it will be re-provisioned`);
                return null;
            }
            return this.handleError('customer lookup', error);
        }
    }
    async fetchCustomerByEmail(email) {
        try {
            const response = await this.client.get('/customer', { params: { email } });
            const list = Array.isArray(response.data?.data) ? response.data.data : [];
            const match = list.find((entry) => (entry.email ?? '').toLowerCase() === email.trim().toLowerCase());
            if (!match?.customer_code)
                return null;
            return {
                customerCode: match.customer_code,
                email: match.email,
                phone: match.phone,
            };
        }
        catch (error) {
            if (this.isCustomerNotFoundError(error))
                return null;
            return this.handleError('customer lookup', error);
        }
    }
    dvaPreferredBank() {
        return (this.configService.get('PAYSTACK_DVA_PREFERRED_BANK') ??
            'wema-bank');
    }
    async fetchDedicatedAccountProviders() {
        if (this.providerCache &&
            Date.now() - this.providerCache.fetchedAt < 5 * 60_000) {
            return this.providerCache.slugs;
        }
        try {
            const response = await this.client.get('/dedicated_account/available_providers');
            const list = Array.isArray(response?.data?.data)
                ? response.data.data
                : [];
            const slugs = list
                .map((provider) => provider.provider_slug?.trim().toLowerCase())
                .filter((slug) => !!slug);
            if (slugs.length > 0) {
                this.providerCache = { fetchedAt: Date.now(), slugs };
                return slugs;
            }
        }
        catch (error) {
            this.logger.warn(`Could not fetch dedicated account providers: ${this.errorMessage(error)}`);
        }
        return [];
    }
    dvaBankCandidates(available = [], preferred = this.dvaPreferredBank()) {
        const ordered = [preferred, ...available, ...this.DVA_BANK_POOL];
        const seen = new Set();
        return ordered
            .map((bank) => bank.trim().toLowerCase())
            .filter((bank) => {
            if (!bank || seen.has(bank))
                return false;
            seen.add(bank);
            return true;
        });
    }
    isDvaBankUnavailableError(error) {
        return /is not available in test mode|not available for this business|invalid (?:preferred )?bank|bank is not (?:available|supported)|unsupported bank/i.test(this.errorMessage(error));
    }
    async createDedicatedAccount(params) {
        const providers = await this.fetchDedicatedAccountProviders();
        const banks = this.dvaBankCandidates(providers, params.preferredBank);
        let lastError;
        for (const bank of banks) {
            try {
                return await this.requestDedicatedAccount({
                    ...params,
                    preferredBank: bank,
                });
            }
            catch (err) {
                lastError = err;
                if (!this.isDvaBankUnavailableError(err)) {
                    throw err;
                }
                this.logger.warn(`Dedicated account bank "${bank}" unavailable — trying the next provider`);
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
            const payload = response?.data?.data ?? {};
            const account = payload.dedicated_account ?? payload;
            return this.mapDedicatedAccount(account);
        }
        catch (error) {
            return this.handleError('dedicated account creation', error);
        }
    }
    mapDedicatedAccount(account) {
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
    async fetchDedicatedAccounts(customerCode) {
        try {
            const response = await this.client.get('/dedicated_account', { params: { customer: customerCode } });
            const list = Array.isArray(response?.data?.data)
                ? response.data.data
                : [];
            return list
                .map((entry) => this.mapDedicatedAccount(entry.dedicated_account ?? entry))
                .filter((entry) => entry.accountNumber.length > 0);
        }
        catch (error) {
            return this.handleError('dedicated account fetch', error);
        }
    }
    async deactivateDedicatedAccount(accountId) {
        try {
            await this.client.delete(`/dedicated_account/${encodeURIComponent(accountId)}`);
        }
        catch (error) {
            this.handleError('dedicated account deactivation', error);
        }
    }
    async initiateTransfer(params) {
        this.assertConfigured();
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
    keyMode() {
        return this.isTestMode() ? 'test' : 'live';
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