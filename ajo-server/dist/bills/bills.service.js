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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var BillsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
const vtpass_service_1 = require("../payments/vtpass.service");
const wallet_service_1 = require("../wallet/wallet.service");
const notifications_service_1 = require("../notifications/notifications.service");
const notification_events_1 = require("../notifications/notification-events");
const users_service_1 = require("../users/users.service");
const bill_provider_config_schema_1 = require("./schemas/bill-provider-config.schema");
const bill_service_plan_schema_1 = require("./schemas/bill-service-plan.schema");
const bill_transaction_schema_1 = require("./schemas/bill-transaction.schema");
const BILL_SERVICE_TYPES = ['airtime', 'data', 'cable', 'electricity'];
const DATA_NETWORKS = {
    mtn: { serviceId: 'mtn-data', bucket: 'MTN' },
    airtel: { serviceId: 'airtel-data', bucket: 'AIRTEL' },
    glo: { serviceId: 'glo-data', bucket: 'GLO' },
    '9mobile': { serviceId: 'etisalat-data', bucket: '9MOBILE' },
};
const AIRTIME_NETWORK_SERVICE = {
    mtn: 'mtn',
    airtel: 'airtel',
    glo: 'glo',
    '9mobile': 'etisalat',
};
const CABLE_PROVIDER_SERVICE_IDS = {
    dstv: 'dstv',
    gotv: 'gotv',
    startimes: 'startimes',
};
const CABLE_PROVIDERS = Object.keys(CABLE_PROVIDER_SERVICE_IDS);
const PRICE_ONLY_SEGMENT = /^(?:₦|NGN|N)?\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:naira|ngn)?$/i;
const TRAILING_PRICE = /(?:\s+[-–—]\s+|\s+)\(?(?:₦|NGN|N)?\s?\d[\d,]*(?:\.\d{1,2})?\s*(?:naira|ngn)?\)?$/i;
function stripPlanPrice(rawName) {
    const kept = rawName
        .split(/\s+[-–—]\s+/)
        .filter((segment) => !PRICE_ONLY_SEGMENT.test(segment.trim()));
    const stripped = kept.join(' - ').replace(TRAILING_PRICE, '');
    return (stripped.trim() || rawName).replace(/\s+/g, ' ').trim();
}
function bouquetKey(name) {
    return (name ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
const CATALOGUE_CACHE_TTL_MS = 5 * 60_000;
function cashbackFor(amount, percent) {
    const rate = typeof percent === 'number' && Number.isFinite(percent)
        ? Math.min(Math.max(percent, 0), 100)
        : 0;
    if (rate <= 0 || amount <= 0)
        return 0;
    return Math.round(((amount * rate) / 100) * 100) / 100;
}
function clampCashbackPercent(percent) {
    if (typeof percent !== 'number' || !Number.isFinite(percent))
        return 0;
    return Math.min(Math.max(percent, 0), 100);
}
const ELECTRICITY_MIN_AMOUNT = 500;
const ELECTRICITY_MAX_AMOUNT = 500_000;
const BILLS_PROVIDER = 'vtpass';
let BillsService = BillsService_1 = class BillsService {
    vtpass;
    walletService;
    usersService;
    notificationsService;
    connection;
    providerConfigModel;
    servicePlanModel;
    billTransactionModel;
    logger = new common_1.Logger(BillsService_1.name);
    catalogueCache = new Map();
    constructor(vtpass, walletService, usersService, notificationsService, connection, providerConfigModel, servicePlanModel, billTransactionModel) {
        this.vtpass = vtpass;
        this.walletService = walletService;
        this.usersService = usersService;
        this.notificationsService = notificationsService;
        this.connection = connection;
        this.providerConfigModel = providerConfigModel;
        this.servicePlanModel = servicePlanModel;
        this.billTransactionModel = billTransactionModel;
    }
    assertBillsConfigured() {
        if (this.vtpass.isConfigured())
            return;
        throw new common_1.ServiceUnavailableException(`Bill payments are not configured on this server: ${this.vtpass.missingConfig().join(', ')} missing. Add the VTpass key pair to ajo-server/.env and restart the server.`);
    }
    async getPlatformAdminUserId() {
        const admin = await this.usersService.findPlatformAdmin();
        return admin._id.toString();
    }
    async planCashbackPercent(serviceType, externalId) {
        if (!externalId)
            return 0;
        const row = await this.servicePlanModel
            .findOne({ serviceType, provider: BILLS_PROVIDER, externalId })
            .lean();
        return clampCashbackPercent(row?.cashbackPercent);
    }
    async vtpassCatalog(serviceType) {
        if (serviceType === 'data') {
            const out = [];
            for (const [key, { serviceId, bucket }] of Object.entries(DATA_NETWORKS)) {
                try {
                    const variations = await this.vtpass.getServiceVariations(serviceId);
                    out.push(...variations.map((v) => ({
                        externalId: v.variationCode,
                        name: v.name,
                        amount: v.amount,
                        bucket: `${key === '9mobile' ? '9MOBILE' : bucket}`,
                        fixedPrice: v.fixedPrice,
                    })));
                }
                catch (e) {
                    this.logger.warn(`vtpassCatalog data: failed for ${serviceId}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            return out;
        }
        if (serviceType === 'airtime') {
            return Object.entries(AIRTIME_NETWORK_SERVICE).map(([key, serviceId]) => ({
                externalId: serviceId,
                name: key === '9mobile' ? '9MOBILE' : key.toUpperCase(),
                amount: 0,
                bucket: key === '9mobile' ? '9MOBILE' : key.toUpperCase(),
            }));
        }
        if (serviceType === 'cable') {
            const out = [];
            for (const provider of CABLE_PROVIDERS) {
                try {
                    const variations = await this.vtpass.getServiceVariations(provider);
                    out.push(...variations.map((v) => ({
                        externalId: v.variationCode,
                        name: v.name,
                        amount: v.amount,
                        bucket: provider.toUpperCase(),
                        fixedPrice: v.fixedPrice,
                    })));
                }
                catch (e) {
                    this.logger.warn(`vtpassCatalog cable: failed for ${provider}: ${e instanceof Error ? e.message : String(e)}`);
                }
            }
            return out;
        }
        if (serviceType === 'electricity') {
            return Object.entries(this.DISCO_SERVICE_ID_MAP).map(([key, serviceId]) => ({
                externalId: serviceId,
                name: key.toUpperCase(),
                amount: 0,
                bucket: key.toUpperCase(),
            }));
        }
        return [];
    }
    DISCO_SERVICE_ID_MAP = {
        ikedc: 'ikeja-electric',
        ekedc: 'eko-electric',
        phed: 'portharcourt-electric',
        jed: 'jos-electric',
        aedc: 'abuja-electric',
        kaedco: 'kano-electric',
        ibedc: 'ibadan-electric',
        eedc: 'enugu-electric',
        bedc: 'benin-electric',
        kedco: 'kaduna-electric',
        aba: 'aba-electric',
        yedc: 'yola-electric',
    };
    async resolveLiveCablePlan(provider, variationCode) {
        const { key, bucket } = this.cableProviderEntry(provider);
        const { plans: live, cashback } = await this.liveCablePlans(key);
        const match = live.find((v) => v.variationCode === variationCode);
        if (match)
            return {
                name: stripPlanPrice(match.name),
                amount: match.amount,
                cashbackPercent: cashback.get(match.variationCode) ?? 0,
            };
        const stored = await this.servicePlanModel
            .findOne({
            serviceType: 'cable',
            provider: BILLS_PROVIDER,
            externalId: variationCode,
            bucket: { $regex: `^${bucket}$`, $options: 'i' },
        })
            .lean();
        if (stored && !stored.isActive) {
            throw new common_1.BadRequestException(`${stripPlanPrice(stored.name)} is currently unavailable`);
        }
        throw new common_1.BadRequestException('Invalid cable plan selected');
    }
    async validateMeter(disco, meterNumber, meterType) {
        this.assertBillsConfigured();
        const discoServiceId = this.DISCO_SERVICE_ID_MAP[disco.toLowerCase()] ??
            disco.toLowerCase().replace(/\s+/g, '');
        const result = await this.vtpass.verifyProduct({
            serviceID: discoServiceId,
            billersCode: meterNumber,
        });
        if (!result.valid)
            throw new common_1.BadRequestException(result.message || 'Meter number could not be verified');
        return { meterType, ...this.toValidationResult(result) };
    }
    async validateSmartCard(serviceProvider, smartCardNumber) {
        this.assertBillsConfigured();
        const result = await this.vtpass.verifyProduct({
            serviceID: serviceProvider,
            billersCode: smartCardNumber,
        });
        if (!result.valid)
            throw new common_1.BadRequestException(result.message || 'Smart card could not be verified');
        const validation = this.toValidationResult(result);
        return validation.packageInfo
            ? { ...validation, packageInfo: stripPlanPrice(validation.packageInfo) }
            : validation;
    }
    toValidationResult(result) {
        return {
            valid: true,
            name: result.name,
            customerName: result.name,
            address: result.address,
            packageInfo: result.packageInfo,
            outstanding: result.outstanding,
        };
    }
    async executeBillTransaction(userId, amount, provider, metadata, purchaseFn, options = {}) {
        const user = await this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const paymentSource = options.paymentSource === 'cashback' ? 'cashback' : 'main';
        const cashbackPercent = clampCashbackPercent(options.cashbackPercent);
        const cashbackEarned = cashbackFor(amount, cashbackPercent);
        const reference = `bill_${(0, crypto_1.randomUUID)()}`;
        const session = await this.connection.startSession();
        try {
            const result = await session.withTransaction(async () => {
                const debitResult = await this.walletService.debitForBillPayment(new mongoose_2.Types.ObjectId(userId), amount, reference, metadata, session, { source: paymentSource });
                if (!debitResult)
                    throw new common_1.BadRequestException(paymentSource === 'cashback'
                        ? 'Insufficient cashback balance'
                        : 'Insufficient wallet balance');
                try {
                    const purchaseResult = await purchaseFn();
                    await this.walletService.confirmBillPayment(reference, session);
                    if (cashbackEarned > 0) {
                        try {
                            await this.walletService.creditBillCashback(userId, cashbackEarned, {
                                billReference: reference,
                                billType: metadata.type || 'unknown',
                                cashbackPercent,
                                purchaseAmount: amount,
                            }, session);
                        }
                        catch (cashbackError) {
                            this.logger.error(`Failed to credit cashback for ${reference}: ${cashbackError instanceof Error ? cashbackError.message : String(cashbackError)}`);
                        }
                    }
                    const commission = purchaseResult.commission;
                    if (commission > 0) {
                        try {
                            const adminUserId = await this.getPlatformAdminUserId();
                            await this.walletService.creditBillCommission(adminUserId, commission, {
                                billReference: reference,
                                billType: metadata.type || 'unknown',
                                userPaid: amount,
                                actualCost: amount - commission,
                            }, session);
                        }
                        catch (commissionError) {
                            this.logger.error(`Failed to credit bill commission for ${reference}: ${commissionError instanceof Error ? commissionError.message : String(commissionError)}`);
                        }
                    }
                    const externalReference = purchaseResult.externalTransactionId || purchaseResult.requestId;
                    const providerDetails = purchaseResult.providerData ?? {};
                    const receiptMetadata = {
                        ...metadata,
                        ...(Object.keys(providerDetails).length > 0
                            ? { providerDetails }
                            : {}),
                        providerRequestId: purchaseResult.requestId,
                        ...(cashbackEarned > 0 ? { cashbackEarned, cashbackPercent } : {}),
                    };
                    const [billTx] = await this.billTransactionModel.create([
                        {
                            user: new mongoose_2.Types.ObjectId(userId),
                            type: metadata.type,
                            status: 'success',
                            amount,
                            reference,
                            externalReference,
                            provider,
                            recipient: metadata.recipient || '',
                            metadata: receiptMetadata,
                            walletTransaction: debitResult._id,
                        },
                    ], { session });
                    return this.toBillReceipt({
                        _id: billTx._id.toString(),
                        user: userId,
                        type: metadata.type,
                        status: 'success',
                        amount,
                        reference,
                        externalReference,
                        provider,
                        recipient: metadata.recipient || '',
                        metadata: receiptMetadata,
                        walletTransaction: debitResult._id.toString(),
                        createdAt: billTx.createdAt,
                    });
                }
                catch (externalError) {
                    await this.walletService.failBillPayment(reference, amount, session);
                    throw externalError;
                }
            });
            const summary = await this.walletService.getWalletSummary(userId);
            void summary;
            void this.notificationsService.send(notification_events_1.NotificationEvents.billPaymentSuccess({
                userIds: [userId],
                amount,
                serviceType: metadata.type,
                recipient: metadata.recipient,
            }));
            return result;
        }
        finally {
            await session.endSession();
        }
    }
    async purchaseAirtime(userId, dto) {
        this.assertBillsConfigured();
        const serviceId = AIRTIME_NETWORK_SERVICE[dto.network] || dto.network;
        const cashbackPercent = await this.planCashbackPercent('airtime', serviceId);
        return this.executeBillTransaction(userId, dto.amount, BILLS_PROVIDER, {
            type: 'airtime',
            network: dto.network,
            phone: dto.phone,
            recipient: dto.phone,
        }, () => this.vtpass.purchaseAirtime({
            serviceID: serviceId,
            phone: dto.phone,
            amount: dto.amount,
        }), { paymentSource: dto.paymentSource, cashbackPercent });
    }
    async purchaseData(userId, dto) {
        this.assertBillsConfigured();
        const { serviceId } = this.dataNetworkEntry(dto.network);
        const plan = await this.resolveLiveDataPlan(dto.network, dto.dataPlanId);
        return this.executeBillTransaction(userId, plan.amount, BILLS_PROVIDER, {
            type: 'data',
            variationCode: dto.dataPlanId,
            planName: plan.name,
            network: dto.network,
            phone: dto.phone,
            recipient: dto.phone,
        }, () => this.vtpass.purchaseData({
            serviceID: serviceId,
            phone: dto.phone,
            variationCode: dto.dataPlanId,
        }), {
            paymentSource: dto.paymentSource,
            cashbackPercent: plan.cashbackPercent,
        });
    }
    async purchaseCable(userId, dto) {
        this.assertBillsConfigured();
        const user = await this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        if (!dto.variationCode) {
            throw new common_1.BadRequestException('A cable/bouquet plan must be selected');
        }
        const plan = await this.resolveLiveCablePlan(dto.serviceProvider, dto.variationCode);
        return this.executeBillTransaction(userId, plan.amount, BILLS_PROVIDER, {
            type: 'cable',
            serviceProvider: dto.serviceProvider,
            smartCardNumber: dto.smartCardNumber,
            variationCode: dto.variationCode,
            planName: plan.name,
            ...(dto.customerName ? { customerName: dto.customerName } : {}),
            recipient: dto.smartCardNumber,
        }, () => this.vtpass.purchaseCable({
            serviceID: dto.serviceProvider,
            billersCode: dto.smartCardNumber,
            amount: plan.amount,
            phone: user.phone,
            variationCode: dto.variationCode,
        }), {
            paymentSource: dto.paymentSource,
            cashbackPercent: plan.cashbackPercent,
        });
    }
    async renewCable(userId, dto) {
        this.assertBillsConfigured();
        const user = await this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const { key, serviceId } = this.cableProviderEntry(dto.serviceProvider);
        const verified = await this.vtpass.verifyProduct({
            serviceID: serviceId,
            billersCode: dto.smartCardNumber,
        });
        if (!verified.valid) {
            throw new common_1.BadRequestException(verified.message || 'Smart card could not be verified');
        }
        const currentBouquet = (verified.packageInfo ?? '').trim();
        const outstanding = Math.round(Number(verified.outstanding ?? 0));
        const { plans, cashback } = await this.liveCablePlans(key);
        const current = this.matchCurrentBouquet(plans, currentBouquet, key === 'startimes', outstanding);
        if (key === 'startimes' && !current) {
            throw new common_1.BadRequestException(`Could not find your current StartTimes bouquet (${currentBouquet || 'not reported'}) in the VTpass catalogue. Choose a plan instead.`);
        }
        const renewalAmount = outstanding > 0 ? outstanding : (current?.amount ?? 0);
        if (renewalAmount <= 0) {
            throw new common_1.BadRequestException('This smart card has no active subscription to renew. Choose a plan to start one.');
        }
        if (dto.expectedAmount != null &&
            Math.round(dto.expectedAmount) !== renewalAmount) {
            throw new common_1.BadRequestException(`The renewal price has changed to ₦${renewalAmount.toLocaleString('en-NG')}. Verify the smart card again to continue.`);
        }
        const customerName = dto.customerName ?? verified.name;
        return this.executeBillTransaction(userId, renewalAmount, BILLS_PROVIDER, {
            type: 'cable',
            serviceProvider: key,
            smartCardNumber: dto.smartCardNumber,
            planName: stripPlanPrice(current?.name ||
                currentBouquet ||
                `${key.toUpperCase()} subscription`),
            renewal: true,
            ...(current ? { variationCode: current.variationCode } : {}),
            ...(customerName ? { customerName } : {}),
            recipient: dto.smartCardNumber,
        }, () => this.vtpass.purchaseCable({
            serviceID: serviceId,
            billersCode: dto.smartCardNumber,
            amount: renewalAmount,
            phone: user.phone,
            ...(key === 'startimes' && current
                ? { variationCode: current.variationCode }
                : {}),
            renewCurrentBouquet: true,
        }), {
            paymentSource: dto.paymentSource,
            cashbackPercent: current
                ? (cashback.get(current.variationCode) ?? 0)
                : 0,
        });
    }
    async purchaseElectricity(userId, dto) {
        this.assertBillsConfigured();
        const amount = Math.round(dto.amount);
        if (amount < ELECTRICITY_MIN_AMOUNT || amount > ELECTRICITY_MAX_AMOUNT) {
            throw new common_1.BadRequestException(`Electricity payments must be between ₦${ELECTRICITY_MIN_AMOUNT} and ₦${ELECTRICITY_MAX_AMOUNT.toLocaleString('en-NG')}`);
        }
        const user = await this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const accountPhone = user.phone?.trim() ?? '';
        const phone = accountPhone || (dto.phone ?? '').trim();
        if (!phone) {
            throw new common_1.BadRequestException('Your profile has no phone number on file. Add one to pay electricity bills.');
        }
        const discoServiceId = this.DISCO_SERVICE_ID_MAP[dto.disco.toLowerCase()] ??
            dto.disco.toLowerCase().replace(/\s+/g, '');
        return this.executeBillTransaction(userId, amount, BILLS_PROVIDER, {
            type: 'electricity',
            disco: dto.disco,
            meterNumber: dto.meterNumber,
            meterType: dto.meterType,
            ...(dto.customerName ? { customerName: dto.customerName } : {}),
            recipient: dto.meterNumber,
            phone,
        }, () => this.vtpass.purchaseElectricity({
            serviceID: discoServiceId,
            billersCode: dto.meterNumber,
            amount,
            phone,
            variationCode: dto.meterType,
        }), {
            paymentSource: dto.paymentSource,
            cashbackPercent: await this.planCashbackPercent('electricity', discoServiceId),
        });
    }
    dataNetworkEntry(network) {
        const key = (network ?? '').trim().toLowerCase();
        const entry = DATA_NETWORKS[key];
        if (!entry) {
            throw new common_1.BadRequestException(`Unknown data network "${network}". Supported networks: ${Object.keys(DATA_NETWORKS).join(', ')}`);
        }
        return { key, ...entry };
    }
    cableProviderEntry(provider) {
        const key = (provider ?? '').trim().toLowerCase();
        const serviceId = CABLE_PROVIDER_SERVICE_IDS[key];
        if (!serviceId) {
            throw new common_1.BadRequestException(`Unknown cable provider "${provider}". Supported providers: ${CABLE_PROVIDERS.join(', ')}`);
        }
        return { key, serviceId, bucket: key.toUpperCase() };
    }
    async liveCatalogue(params) {
        const cacheKey = `${params.serviceType}:${params.key}`;
        const cached = this.catalogueCache.get(cacheKey);
        let variations;
        if (cached && Date.now() - cached.fetchedAt < CATALOGUE_CACHE_TTL_MS) {
            variations = cached.plans;
        }
        else {
            variations = await this.vtpass.getServiceVariations(params.serviceId);
            this.catalogueCache.set(cacheKey, {
                fetchedAt: Date.now(),
                plans: variations,
            });
        }
        const { offIds, cashback } = await this.planOverlay(params.serviceType, params.bucket);
        const plans = variations
            .filter((variation) => !offIds.has(variation.variationCode))
            .sort((a, b) => a.amount - b.amount);
        return { plans, cashback };
    }
    async planOverlay(serviceType, bucket) {
        const rows = await this.servicePlanModel
            .find({
            serviceType,
            provider: BILLS_PROVIDER,
            bucket: { $regex: `^${bucket}$`, $options: 'i' },
        })
            .lean();
        return {
            offIds: new Set(rows
                .filter((row) => row.isActive === false)
                .map((row) => row.externalId)),
            cashback: new Map(rows.map((row) => [
                row.externalId,
                clampCashbackPercent(row.cashbackPercent),
            ])),
        };
    }
    liveDataPlans(network) {
        const { key, serviceId, bucket } = this.dataNetworkEntry(network);
        return this.liveCatalogue({ serviceType: 'data', key, serviceId, bucket });
    }
    liveCablePlans(provider) {
        const { key, serviceId, bucket } = this.cableProviderEntry(provider);
        return this.liveCatalogue({ serviceType: 'cable', key, serviceId, bucket });
    }
    matchCurrentBouquet(plans, currentBouquet, requireExact = false, amountHint = 0) {
        const target = bouquetKey(currentBouquet);
        if (!target)
            return undefined;
        const keyed = plans
            .map((plan) => ({ plan, key: bouquetKey(stripPlanPrice(plan.name)) }))
            .filter((entry) => entry.key.length > 0);
        const exact = keyed.find((entry) => entry.key === target);
        if (exact)
            return exact.plan;
        let candidates = keyed.filter((entry) => entry.key.includes(target) || target.includes(entry.key));
        if (candidates.length > 1 && amountHint > 0) {
            const byAmount = candidates.filter((entry) => Math.round(entry.plan.amount) === Math.round(amountHint));
            if (byAmount.length > 0)
                candidates = byAmount;
        }
        if (requireExact && candidates.length !== 1)
            return undefined;
        return candidates[0]?.plan;
    }
    async resolveLiveDataPlan(network, variationCode) {
        if (!variationCode) {
            throw new common_1.BadRequestException('A data plan must be selected');
        }
        const { bucket } = this.dataNetworkEntry(network);
        const { plans: live, cashback } = await this.liveDataPlans(network);
        const match = live.find((variation) => variation.variationCode === variationCode);
        if (match)
            return {
                name: match.name,
                amount: match.amount,
                cashbackPercent: cashback.get(match.variationCode) ?? 0,
            };
        const stored = await this.servicePlanModel
            .findOne({
            serviceType: 'data',
            provider: BILLS_PROVIDER,
            externalId: variationCode,
            bucket: { $regex: `^${bucket}$`, $options: 'i' },
        })
            .lean();
        if (stored && !stored.isActive) {
            throw new common_1.BadRequestException(`${stored.name} is currently unavailable`);
        }
        throw new common_1.BadRequestException('Invalid data plan selected');
    }
    async getDataPlans(network) {
        this.assertBillsConfigured();
        const { plans, cashback } = await this.liveDataPlans(network);
        return plans.map((plan) => ({
            variationCode: plan.variationCode,
            name: plan.name,
            amount: plan.amount,
            fixedPrice: plan.fixedPrice,
            cashbackPercent: cashback.get(plan.variationCode) ?? 0,
            cashback: cashbackFor(plan.amount, cashback.get(plan.variationCode)),
        }));
    }
    async getCablePlans(provider) {
        this.assertBillsConfigured();
        const { plans, cashback } = await this.liveCablePlans(provider);
        return plans.map((plan) => ({
            variationCode: plan.variationCode,
            name: stripPlanPrice(plan.name),
            amount: plan.amount,
            fixedPrice: plan.fixedPrice,
            cashbackPercent: cashback.get(plan.variationCode) ?? 0,
            cashback: cashbackFor(plan.amount, cashback.get(plan.variationCode)),
        }));
    }
    async estimateCashback(params) {
        this.assertBillsConfigured();
        const requested = Math.round(Number(params.amount ?? 0) || 0);
        const provider = (params.provider ?? '').trim();
        let purchaseAmount = requested;
        let cashbackPercent = 0;
        if (params.serviceType === 'data') {
            const plan = await this.resolveLiveDataPlan(provider, params.variationCode ?? '');
            purchaseAmount = plan.amount;
            cashbackPercent = plan.cashbackPercent;
        }
        else if (params.serviceType === 'cable') {
            if (params.variationCode) {
                const plan = await this.resolveLiveCablePlan(provider, params.variationCode);
                purchaseAmount = plan.amount;
                cashbackPercent = plan.cashbackPercent;
            }
            else {
                const { plans, cashback } = await this.liveCablePlans(provider);
                const current = this.matchCurrentBouquet(plans, params.packageName, false, requested);
                cashbackPercent = current
                    ? (cashback.get(current.variationCode) ?? 0)
                    : 0;
            }
        }
        else if (params.serviceType === 'airtime') {
            const serviceId = AIRTIME_NETWORK_SERVICE[provider] || provider;
            cashbackPercent = await this.planCashbackPercent('airtime', serviceId);
        }
        else {
            const discoServiceId = this.DISCO_SERVICE_ID_MAP[provider.toLowerCase()] ??
                provider.toLowerCase().replace(/\s+/g, '');
            cashbackPercent = await this.planCashbackPercent('electricity', discoServiceId);
        }
        return {
            serviceType: params.serviceType,
            purchaseAmount,
            cashbackPercent,
            cashback: cashbackFor(purchaseAmount, cashbackPercent),
        };
    }
    async getActiveServiceTypes() {
        const stats = await this.servicePlanModel.aggregate([
            {
                $match: { provider: BILLS_PROVIDER },
            },
            {
                $group: {
                    _id: '$serviceType',
                    total: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                },
            },
        ]);
        const byType = new Map(stats.map((stat) => [stat._id, stat]));
        return BILL_SERVICE_TYPES.filter((serviceType) => {
            const stat = byType.get(serviceType);
            if (!stat)
                return true;
            return stat.active > 0;
        });
    }
    async listCatalogStatus() {
        const configs = await this.providerConfigModel.find({}).lean();
        const counts = await this.servicePlanModel.aggregate([
            {
                $match: { provider: BILLS_PROVIDER },
            },
            {
                $group: {
                    _id: '$serviceType',
                    total: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                },
            },
        ]);
        const byType = new Map(counts.map((count) => [count._id, count]));
        return BILL_SERVICE_TYPES.map((serviceType) => {
            const cfg = configs.find((c) => c.serviceType === serviceType);
            const stat = byType.get(serviceType);
            return {
                serviceType,
                lastSyncedAt: cfg?.lastSyncedAt ?? undefined,
                lastSyncStatus: cfg?.lastSyncStatus ?? 'never',
                planTotal: stat?.total ?? 0,
                planActive: stat?.active ?? 0,
                configured: Boolean(cfg),
            };
        });
    }
    async syncPlans(serviceType) {
        this.assertBillsConfigured();
        const provider = BILLS_PROVIDER;
        const plans = await this.vtpassCatalog(serviceType);
        let created = 0;
        let updated = 0;
        for (const p of plans) {
            const result = await this.servicePlanModel.updateOne({ serviceType, provider, externalId: p.externalId }, {
                $set: {
                    serviceType,
                    provider,
                    externalId: p.externalId,
                    name: p.name,
                    bucket: p.bucket,
                    amount: p.amount,
                    fixedPrice: p.fixedPrice ?? true,
                    ...(p.meta ? { meta: p.meta } : {}),
                },
                $setOnInsert: { isActive: true },
            }, { upsert: true });
            if (result.upsertedCount === 1)
                created += 1;
            else if (result.matchedCount === 1 && result.modifiedCount === 1)
                updated += 1;
        }
        const remainingIds = plans.map((p) => p.externalId);
        const removed = await this.servicePlanModel.deleteMany({
            serviceType,
            provider,
            externalId: { $nin: remainingIds },
        });
        await this.providerConfigModel.updateOne({ serviceType }, {
            $set: {
                lastSyncedAt: new Date(),
                lastSyncStatus: 'success',
                planCount: plans.length,
            },
        }, { upsert: true });
        return {
            serviceType,
            provider,
            total: plans.length,
            created,
            updated,
            removed: removed.deletedCount,
        };
    }
    async listPlansAdmin(query = {}) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 50;
        const skip = (page - 1) * limit;
        const filter = { provider: BILLS_PROVIDER };
        if (query.serviceType)
            filter.serviceType = query.serviceType;
        if (query.bucket)
            filter.bucket = query.bucket;
        const [total, plans] = await Promise.all([
            this.servicePlanModel.countDocuments(filter),
            this.servicePlanModel
                .find(filter)
                .sort({ serviceType: 1, bucket: 1, amount: 1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);
        return {
            plans: plans.map((p) => ({
                id: p._id.toString(),
                serviceType: p.serviceType,
                provider: p.provider,
                externalId: p.externalId,
                name: p.serviceType === 'cable' ? stripPlanPrice(p.name) : p.name,
                bucket: p.bucket,
                amount: p.amount,
                fixedPrice: p.fixedPrice,
                isActive: p.isActive,
                cashbackPercent: clampCashbackPercent(p.cashbackPercent),
                updatedAt: p.updatedAt,
            })),
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        };
    }
    async setPlanActive(id, isActive) {
        const plan = await this.servicePlanModel.findById(id);
        if (!plan)
            throw new common_1.NotFoundException('Plan not found');
        plan.isActive = isActive;
        await plan.save();
        return {
            id: plan._id.toString(),
            serviceType: plan.serviceType,
            name: plan.name,
            isActive: plan.isActive,
        };
    }
    async setPlanCashback(id, cashbackPercent) {
        if (!Number.isFinite(cashbackPercent)) {
            throw new common_1.BadRequestException('Cashback percentage must be a number');
        }
        if (cashbackPercent < 0 || cashbackPercent > 100) {
            throw new common_1.BadRequestException('Cashback percentage must be between 0 and 100');
        }
        const plan = await this.servicePlanModel.findById(id);
        if (!plan)
            throw new common_1.NotFoundException('Plan not found');
        if (plan.provider !== BILLS_PROVIDER) {
            throw new common_1.BadRequestException(`This plan belongs to a retired provider (${plan.provider}) and is not sold to members`);
        }
        plan.cashbackPercent = Math.round(cashbackPercent * 100) / 100;
        await plan.save();
        return {
            id: plan._id.toString(),
            serviceType: plan.serviceType,
            name: plan.name,
            bucket: plan.bucket,
            cashbackPercent: plan.cashbackPercent,
        };
    }
    toBillReceipt(raw) {
        return {
            _id: raw._id,
            user: raw.user.toString(),
            type: raw.type,
            status: 'success',
            amount: raw.amount,
            reference: raw.reference,
            externalReference: raw.externalReference,
            provider: raw.provider,
            recipient: raw.recipient,
            metadata: raw.metadata,
            walletTransaction: raw.walletTransaction?.toString(),
            createdAt: raw.createdAt?.toISOString(),
        };
    }
    async getHistory(userId, query = {}) {
        const filter = {
            user: new mongoose_2.Types.ObjectId(userId),
        };
        if (query.serviceType)
            filter.type = query.serviceType;
        const txns = await this.billTransactionModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        return txns.map((t) => this.toBillReceipt({
            _id: t._id.toString(),
            user: t.user.toString(),
            type: t.type,
            status: 'success',
            amount: t.amount,
            reference: t.reference,
            externalReference: t.externalReference,
            provider: t.provider,
            recipient: t.recipient,
            metadata: t.metadata,
            walletTransaction: t.walletTransaction
                ? t.walletTransaction.toString()
                : undefined,
            createdAt: t.createdAt,
        }));
    }
    async getReceipt(userId, reference) {
        const txn = await this.billTransactionModel
            .findOne({ user: new mongoose_2.Types.ObjectId(userId), reference })
            .lean();
        if (!txn)
            throw new common_1.NotFoundException('Receipt not found');
        return this.toBillReceipt({
            _id: txn._id.toString(),
            user: txn.user.toString(),
            type: txn.type,
            status: 'success',
            amount: txn.amount,
            reference: txn.reference,
            externalReference: txn.externalReference,
            provider: txn.provider,
            recipient: txn.recipient,
            metadata: txn.metadata,
            walletTransaction: txn.walletTransaction
                ? txn.walletTransaction.toString()
                : undefined,
            createdAt: txn.createdAt,
        });
    }
    toAdminBillTransaction(raw, user) {
        const id = raw._id.toString();
        return {
            id,
            user: {
                id: raw.user.toString(),
                name: user?.name,
                phone: user?.phone ?? '—',
            },
            type: raw.type,
            status: raw.status,
            amount: raw.amount,
            reference: raw.reference,
            externalReference: raw.externalReference,
            provider: raw.provider,
            recipient: raw.recipient,
            metadata: raw.metadata,
            walletTransaction: raw.walletTransaction?.toString(),
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }
    async listTransactionsAdmin(query = {}) {
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        const filter = {};
        if (query.serviceType)
            filter.type = query.serviceType;
        if (query.status)
            filter.status = query.status;
        if (query.userId)
            filter.user = new mongoose_2.Types.ObjectId(query.userId);
        const [total, transactions] = await Promise.all([
            this.billTransactionModel.countDocuments(filter),
            this.billTransactionModel
                .find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
        ]);
        const userIds = [...new Set(transactions.map((t) => t.user.toString()))];
        const users = await this.usersService.findByIds(userIds);
        const userById = new Map(users.map((u) => [u._id.toString(), u]));
        return {
            transactions: transactions.map((t) => this.toAdminBillTransaction(t, userById.get(t.user.toString()))),
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        };
    }
    async getReceiptAdmin(id) {
        if (!mongoose_2.Types.ObjectId.isValid(id)) {
            throw new common_1.NotFoundException('Receipt not found');
        }
        const txn = await this.billTransactionModel.findById(id).lean();
        if (!txn)
            throw new common_1.NotFoundException('Receipt not found');
        const [owner] = await this.usersService.findByIds([txn.user.toString()]);
        return this.toAdminBillTransaction(txn, owner
            ? { _id: owner._id, name: owner.name, phone: owner.phone }
            : undefined);
    }
};
exports.BillsService = BillsService;
exports.BillsService = BillsService = BillsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, mongoose_1.InjectConnection)()),
    __param(5, (0, mongoose_1.InjectModel)(bill_provider_config_schema_1.BillProviderConfig.name)),
    __param(6, (0, mongoose_1.InjectModel)(bill_service_plan_schema_1.BillServicePlan.name)),
    __param(7, (0, mongoose_1.InjectModel)(bill_transaction_schema_1.BillTransaction.name)),
    __metadata("design:paramtypes", [vtpass_service_1.VTPassService,
        wallet_service_1.WalletService,
        users_service_1.UsersService,
        notifications_service_1.NotificationsService,
        mongoose_2.Connection,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], BillsService);
//# sourceMappingURL=bills.service.js.map