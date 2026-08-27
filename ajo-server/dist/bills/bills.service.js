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
const gladtidings_service_1 = require("../payments/gladtidings.service");
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
const CABLE_PROVIDERS = ['dstv', 'gotv', 'startimes'];
let BillsService = BillsService_1 = class BillsService {
    vtpass;
    gladtidings;
    walletService;
    usersService;
    notificationsService;
    connection;
    providerConfigModel;
    servicePlanModel;
    billTransactionModel;
    logger = new common_1.Logger(BillsService_1.name);
    constructor(vtpass, gladtidings, walletService, usersService, notificationsService, connection, providerConfigModel, servicePlanModel, billTransactionModel) {
        this.vtpass = vtpass;
        this.gladtidings = gladtidings;
        this.walletService = walletService;
        this.usersService = usersService;
        this.notificationsService = notificationsService;
        this.connection = connection;
        this.providerConfigModel = providerConfigModel;
        this.servicePlanModel = servicePlanModel;
        this.billTransactionModel = billTransactionModel;
    }
    async onModuleInit() {
        try {
            const { modifiedCount } = await this.servicePlanModel.updateMany({ provider: 'gladtidings', isActive: true }, { $set: { isActive: false } });
            if (modifiedCount > 0) {
                this.logger.warn(`[BillsService] Startup backfill: switched off ${modifiedCount} gladtidings plan(s)`);
            }
        }
        catch (e) {
            this.logger.error(`[BillsService] Failed to backfill gladtidings plans off: ${e instanceof Error ? e.message : String(e)}`);
        }
    }
    async getPlatformAdminUserId() {
        const admin = await this.usersService.findPlatformAdmin();
        return admin._id.toString();
    }
    async resolveProvider(serviceType) {
        const cfg = await this.providerConfigModel.findOne({ serviceType }).lean();
        return cfg?.activeProvider ?? 'vtpass';
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
    async validateMeter(disco, meterNumber, meterType) {
        const discoServiceId = this.DISCO_SERVICE_ID_MAP[disco.toLowerCase()] ??
            disco.toLowerCase().replace(/\s+/g, '');
        console.log('[BillsService] validateMeter params:', {
            disco,
            discoServiceId,
            meterNumber,
            meterType,
        });
        const result = await this.vtpass.verifyProduct({
            serviceID: discoServiceId,
            billersCode: meterNumber,
        });
        console.log('[BillsService] validateMeter vtpass result:', result);
        if (!result.valid)
            throw new common_1.BadRequestException(result.message || 'Meter number could not be verified');
        return {
            valid: true,
            customerName: result.name,
            address: result.address,
            packageInfo: result.packageInfo,
            outstanding: result.outstanding,
        };
    }
    async validateSmartCard(serviceProvider, smartCardNumber) {
        console.log('[BillsService] validateSmartCard raw vtpass response:', serviceProvider, smartCardNumber);
        const result = await this.vtpass.verifyProduct({
            serviceID: serviceProvider,
            billersCode: smartCardNumber,
        });
        console.log('[BillsService] validateSmartCard processed result:', result);
        if (!result.valid)
            throw new common_1.BadRequestException(result.message || 'Smart card could not be verified');
        return {
            valid: true,
            customerName: result.name,
            address: result.address,
            packageInfo: result.packageInfo,
            outstanding: result.outstanding,
        };
    }
    async executeBillTransaction(userId, amount, provider, metadata, purchaseFn) {
        const user = await this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const reference = `bill_${(0, crypto_1.randomUUID)()}`;
        const session = await this.connection.startSession();
        try {
            const result = await session.withTransaction(async () => {
                const debitResult = await this.walletService.debitForBillPayment(new mongoose_2.Types.ObjectId(userId), amount, reference, metadata, session);
                if (!debitResult)
                    throw new common_1.BadRequestException('Insufficient wallet balance');
                try {
                    const purchaseResult = await purchaseFn();
                    await this.walletService.confirmBillPayment(reference, session);
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
        const provider = await this.resolveProvider('airtime');
        if (provider === 'gladtidings') {
            return this.executeBillTransaction(userId, dto.amount, 'gladtidings', {
                type: 'airtime',
                network: dto.network,
                phone: dto.phone,
                recipient: dto.phone,
            }, () => this.gladtidings.purchaseAirtime({
                network: dto.network,
                amount: dto.amount,
                phone: dto.phone,
                ported: false,
            }));
        }
        const serviceId = AIRTIME_NETWORK_SERVICE[dto.network] || dto.network;
        return this.executeBillTransaction(userId, dto.amount, 'vtpass', {
            type: 'airtime',
            network: dto.network,
            phone: dto.phone,
            recipient: dto.phone,
        }, () => this.vtpass.purchaseAirtime({
            serviceID: serviceId,
            phone: dto.phone,
            amount: dto.amount,
        }));
    }
    async purchaseData(userId, dto) {
        const provider = await this.resolveProvider('data');
        if (provider === 'gladtidings') {
            const plan = await this.servicePlanModel
                .findOne({
                serviceType: 'data',
                provider: 'gladtidings',
                externalId: dto.dataPlanId,
                isActive: true,
            })
                .lean();
            if (!plan)
                throw new common_1.BadRequestException('Invalid data plan selected');
            return this.executeBillTransaction(userId, plan.amount, 'gladtidings', {
                type: 'data',
                variationCode: dto.dataPlanId,
                planName: plan.name,
                network: dto.network,
                phone: dto.phone,
                recipient: dto.phone,
            }, () => this.gladtidings.purchaseData({
                network: dto.network,
                planId: plan.externalId,
                planAmount: plan.amount,
                phone: dto.phone,
                ported: false,
            }));
        }
        const dataNetwork = DATA_NETWORKS[dto.network];
        const serviceId = dataNetwork?.serviceId || 'mtn-data';
        const variations = await this.vtpass.getServiceVariations(serviceId);
        const variation = variations.find((v) => v.variationCode === dto.dataPlanId);
        if (!variation)
            throw new common_1.BadRequestException('Invalid data plan selected');
        return this.executeBillTransaction(userId, variation.amount, 'vtpass', {
            type: 'data',
            variationCode: dto.dataPlanId,
            planName: variation.name,
            network: dto.network,
            phone: dto.phone,
            recipient: dto.phone,
        }, () => this.vtpass.purchaseData({
            serviceID: serviceId,
            phone: dto.phone,
            variationCode: dto.dataPlanId,
        }));
    }
    async purchaseCable(userId, dto) {
        const user = await this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const provider = await this.resolveProvider('cable');
        if (provider === 'gladtidings') {
            if (!dto.variationCode)
                throw new common_1.BadRequestException('A cable plan must be selected');
            const plan = await this.servicePlanModel
                .findOne({
                serviceType: 'cable',
                provider: 'gladtidings',
                externalId: dto.variationCode,
                isActive: true,
            })
                .lean();
            if (!plan)
                throw new common_1.BadRequestException('Invalid cable plan selected');
            return this.executeBillTransaction(userId, plan.amount, 'gladtidings', {
                type: 'cable',
                serviceProvider: dto.serviceProvider,
                smartCardNumber: dto.smartCardNumber,
                variationCode: dto.variationCode,
                packageName: plan.name,
                ...(dto.customerName ? { customerName: dto.customerName } : {}),
                recipient: dto.smartCardNumber,
            }, () => this.gladtidings.purchaseCable({
                provider: plan.bucket,
                planId: plan.externalId,
                planAmount: plan.amount,
                smartCardNumber: dto.smartCardNumber,
                phone: user.phone,
            }));
        }
        return this.executeBillTransaction(userId, dto.amount, 'vtpass', {
            type: 'cable',
            serviceProvider: dto.serviceProvider,
            smartCardNumber: dto.smartCardNumber,
            variationCode: dto.variationCode,
            ...(dto.customerName ? { customerName: dto.customerName } : {}),
            recipient: dto.smartCardNumber,
        }, () => this.vtpass.purchaseCable({
            serviceID: dto.serviceProvider,
            billersCode: dto.smartCardNumber,
            amount: dto.amount,
            phone: user.phone,
            variationCode: dto.variationCode,
        }));
    }
    async purchaseElectricity(userId, dto) {
        const provider = await this.resolveProvider('electricity');
        if (provider === 'gladtidings') {
            return this.executeBillTransaction(userId, dto.amount, 'gladtidings', {
                type: 'electricity',
                disco: dto.disco,
                meterNumber: dto.meterNumber,
                meterType: dto.meterType,
                ...(dto.customerName ? { customerName: dto.customerName } : {}),
                recipient: dto.meterNumber,
                phone: dto.phone,
            }, () => this.gladtidings.purchaseElectricity(dto.disco, dto.meterNumber, dto.amount, dto.phone));
        }
        const discoServiceId = this.DISCO_SERVICE_ID_MAP[dto.disco.toLowerCase()] ??
            dto.disco.toLowerCase().replace(/\s+/g, '');
        return this.executeBillTransaction(userId, dto.amount, 'vtpass', {
            type: 'electricity',
            disco: dto.disco,
            meterNumber: dto.meterNumber,
            meterType: dto.meterType,
            ...(dto.customerName ? { customerName: dto.customerName } : {}),
            recipient: dto.meterNumber,
            phone: dto.phone,
        }, () => this.vtpass.purchaseElectricity({
            serviceID: discoServiceId,
            billersCode: dto.meterNumber,
            amount: dto.amount,
            phone: dto.phone,
            variationCode: dto.meterType,
        }));
    }
    async getDataPlans(network) {
        const bucket = network === '9mobile' ? '9MOBILE' : network.toUpperCase();
        const dataNetwork = DATA_NETWORKS[network];
        const provider = await this.resolveProvider('data');
        const bucketFilter = { $regex: `^${bucket}$`, $options: 'i' };
        const synced = await this.servicePlanModel
            .find({
            serviceType: 'data',
            provider,
            bucket: bucketFilter,
            isActive: true,
        })
            .sort({ amount: 1 })
            .lean();
        if (synced.length) {
            return synced.map((p) => ({
                variationCode: p.externalId,
                name: p.name,
                amount: p.amount,
                fixedPrice: p.fixedPrice,
            }));
        }
        const everSynced = await this.servicePlanModel.exists({
            serviceType: 'data',
            provider,
            bucket: bucketFilter,
        });
        if (everSynced)
            return [];
        const serviceId = dataNetwork?.serviceId || 'mtn-data';
        return this.vtpass.getServiceVariations(serviceId);
    }
    async getCablePlans(provider) {
        const activeProvider = await this.resolveProvider('cable');
        const synced = await this.servicePlanModel
            .find({
            serviceType: 'cable',
            provider: activeProvider,
            bucket: provider.toUpperCase(),
            isActive: true,
        })
            .sort({ amount: 1 })
            .lean();
        if (synced.length) {
            return synced.map((p) => ({
                variationCode: p.externalId,
                name: p.name,
                amount: p.amount,
                fixedPrice: p.fixedPrice,
            }));
        }
        const everSynced = await this.servicePlanModel.exists({
            serviceType: 'cable',
            provider: activeProvider,
            bucket: provider.toUpperCase(),
        });
        if (everSynced)
            return [];
        return this.vtpass.getServiceVariations(provider.toLowerCase());
    }
    async getActiveServiceTypes() {
        return [...BILL_SERVICE_TYPES];
    }
    async listProviderConfigs() {
        const configs = await this.providerConfigModel.find({}).lean();
        const counts = await this.servicePlanModel.aggregate([
            {
                $group: {
                    _id: { serviceType: '$serviceType', provider: '$provider' },
                    total: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                },
            },
            {
                $project: {
                    _id: 0,
                    serviceType: '$_id.serviceType',
                    provider: '$_id.provider',
                    total: 1,
                    active: 1,
                },
            },
        ]);
        return BILL_SERVICE_TYPES.map((serviceType) => {
            const cfg = configs.find((c) => c.serviceType === serviceType);
            const activeProvider = cfg?.activeProvider ?? 'vtpass';
            const stat = counts.find((c) => c.serviceType === serviceType && c.provider === activeProvider);
            return {
                serviceType,
                activeProvider,
                lastSyncedAt: cfg?.lastSyncedAt ?? undefined,
                lastSyncStatus: cfg?.lastSyncStatus ?? 'never',
                planTotal: stat?.total ?? 0,
                planActive: stat?.active ?? 0,
                configured: Boolean(cfg),
            };
        });
    }
    async setProvider(serviceType, provider) {
        await this.providerConfigModel.updateOne({ serviceType }, { $set: { serviceType, activeProvider: provider } }, { upsert: true });
        return this.listProviderConfigs();
    }
    async syncPlans(serviceType) {
        const provider = await this.resolveProvider(serviceType);
        const plans = provider === 'gladtidings'
            ? await this.gladtidings.getCatalogPlans(serviceType)
            : await this.vtpassCatalog(serviceType);
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
                $setOnInsert: { isActive: provider === 'gladtidings' ? false : true },
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
        const filter = {};
        if (query.serviceType)
            filter.serviceType = query.serviceType;
        if (query.provider)
            filter.provider = query.provider;
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
                name: p.name,
                bucket: p.bucket,
                amount: p.amount,
                fixedPrice: p.fixedPrice,
                isActive: p.isActive,
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
        };
    }
    async getHistory(userId) {
        const txns = await this.billTransactionModel
            .find({ user: userId })
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
        }));
    }
    async getReceipt(userId, reference) {
        const txn = await this.billTransactionModel
            .findOne({ user: userId, reference })
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
    __param(5, (0, mongoose_1.InjectConnection)()),
    __param(6, (0, mongoose_1.InjectModel)(bill_provider_config_schema_1.BillProviderConfig.name)),
    __param(7, (0, mongoose_1.InjectModel)(bill_service_plan_schema_1.BillServicePlan.name)),
    __param(8, (0, mongoose_1.InjectModel)(bill_transaction_schema_1.BillTransaction.name)),
    __metadata("design:paramtypes", [vtpass_service_1.VTPassService,
        gladtidings_service_1.GladTidingsService,
        wallet_service_1.WalletService,
        users_service_1.UsersService,
        notifications_service_1.NotificationsService,
        mongoose_2.Connection,
        mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], BillsService);
//# sourceMappingURL=bills.service.js.map