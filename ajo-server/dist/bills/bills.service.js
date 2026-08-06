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
let BillsService = class BillsService {
    vtpass;
    walletService;
    usersService;
    notificationsService;
    connection;
    constructor(vtpass, walletService, usersService, notificationsService, connection) {
        this.vtpass = vtpass;
        this.walletService = walletService;
        this.usersService = usersService;
        this.notificationsService = notificationsService;
        this.connection = connection;
    }
    async getPlatformAdminUserId() {
        const admin = await this.usersService.findPlatformAdmin();
        return admin._id.toString();
    }
    DISCO_SERVICE_ID_MAP = {
        ikedc: 'ikeja-electric',
        ekedc: 'eko-electric',
        phed: 'phedc',
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
        const discoServiceId = this.DISCO_SERVICE_ID_MAP[disco.toLowerCase()] ?? disco.toLowerCase().replace(/\s+/g, '');
        console.log('[BillsService] validateMeter params:', { disco, discoServiceId, meterNumber, meterType });
        const result = await this.vtpass.verifyProduct({
            serviceID: discoServiceId, billersCode: meterNumber,
        });
        console.log('[BillsService] validateMeter vtpass result:', result);
        if (!result.valid)
            throw new common_1.BadRequestException(result.message || 'Meter number could not be verified');
        return { valid: true, customerName: result.name, address: result.address, packageInfo: result.packageInfo, outstanding: result.outstanding };
    }
    async validateSmartCard(serviceProvider, smartCardNumber) {
        console.log('[BillsService] validateSmartCard raw vtpass response:', serviceProvider, smartCardNumber);
        const result = await this.vtpass.verifyProduct({
            serviceID: serviceProvider, billersCode: smartCardNumber,
        });
        console.log('[BillsService] validateSmartCard processed result:', result);
        if (!result.valid)
            throw new common_1.BadRequestException(result.message || 'Smart card could not be verified');
        return { valid: true, customerName: result.name, address: result.address, packageInfo: result.packageInfo, outstanding: result.outstanding };
    }
    async executeBillTransaction(userId, amount, metadata, purchaseFn) {
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
                    await this.walletService.confirmBillPayment(reference);
                    const commission = purchaseResult.commission;
                    if (commission > 0) {
                        const adminUserId = await this.getPlatformAdminUserId();
                        await this.walletService.creditBillCommission(adminUserId, commission, {
                            billReference: reference,
                            billType: metadata.type || 'unknown',
                            userPaid: amount,
                            actualCost: amount - commission,
                        }, session);
                    }
                    return purchaseResult;
                }
                catch (externalError) {
                    await this.walletService.failBillPayment(reference, amount, session);
                    throw externalError;
                }
            });
            const summary = await this.walletService.getWalletSummary(userId);
            void this.notificationsService.send(notification_events_1.NotificationEvents.billPaymentSuccess({ userIds: [userId], amount, serviceType: metadata.type, recipient: metadata.recipient }));
            return result;
        }
        finally {
            await session.endSession();
        }
    }
    async purchaseAirtime(userId, dto) {
        const serviceMap = { mtn: 'mtn', glo: 'glo', airtel: 'airtel', '9mobile': 'etisalat' };
        const serviceId = serviceMap[dto.network] || dto.network;
        return this.executeBillTransaction(userId, dto.amount, { type: 'airtime', network: dto.network, phone: dto.phone, recipient: dto.phone }, () => this.vtpass.purchaseAirtime({ serviceID: serviceId, phone: dto.phone, amount: dto.amount }));
    }
    async purchaseData(userId, dto) {
        const serviceMap = { mtn: 'mtn-data', airtel: 'airtel-data', glo: 'glo-data', '9mobile': 'etisalat-data' };
        const serviceId = serviceMap[dto.network] || dto.network;
        const variations = await this.vtpass.getServiceVariations(serviceId);
        const variation = variations.find((v) => v.variationCode === dto.dataPlanId);
        if (!variation)
            throw new common_1.BadRequestException('Invalid data plan selected');
        return this.executeBillTransaction(userId, variation.amount, { type: 'data', variationCode: dto.dataPlanId, network: dto.network, phone: dto.phone, recipient: dto.phone }, () => this.vtpass.purchaseData({ serviceID: serviceId, phone: dto.phone, variationCode: dto.dataPlanId }));
    }
    async purchaseCable(userId, dto) {
        const user = await this.usersService.findById(userId);
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.executeBillTransaction(userId, dto.amount, { type: 'cable', serviceProvider: dto.serviceProvider, smartCardNumber: dto.smartCardNumber, recipient: dto.smartCardNumber }, () => this.vtpass.purchaseCable({ serviceID: dto.serviceProvider, billersCode: dto.smartCardNumber, amount: dto.amount, phone: user.phone }));
    }
    async purchaseElectricity(userId, dto) {
        const discoServiceId = this.DISCO_SERVICE_ID_MAP[dto.disco.toLowerCase()] ?? dto.disco.toLowerCase().replace(/\s+/g, '');
        return this.executeBillTransaction(userId, dto.amount, { type: 'electricity', disco: dto.disco, meterNumber: dto.meterNumber, meterType: dto.meterType, recipient: dto.meterNumber, phone: dto.phone }, () => this.vtpass.purchaseElectricity({ serviceID: discoServiceId, billerCode: dto.meterNumber, amount: dto.amount, phone: dto.phone }));
    }
    async getDataPlans(network) {
        const serviceMap = { mtn: 'mtn-data', airtel: 'airtel-data', glo: 'glo-data', '9mobile': 'etisalat-data' };
        const serviceId = serviceMap[network] || 'mtn-data';
        return this.vtpass.getServiceVariations(serviceId);
    }
    async getCablePlans(provider) {
        return this.vtpass.getServiceVariations(provider.toLowerCase());
    }
    async getHistory(userId) {
        return [];
    }
};
exports.BillsService = BillsService;
exports.BillsService = BillsService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [vtpass_service_1.VTPassService,
        wallet_service_1.WalletService,
        users_service_1.UsersService,
        notifications_service_1.NotificationsService,
        mongoose_2.Connection])
], BillsService);
//# sourceMappingURL=bills.service.js.map