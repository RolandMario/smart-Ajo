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
exports.BillsController = void 0;
const common_1 = require("@nestjs/common");
const bills_service_1 = require("./bills.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const purchase_airtime_dto_1 = require("./dto/purchase-airtime.dto");
const purchase_data_dto_1 = require("./dto/purchase-data.dto");
const purchase_cable_dto_1 = require("./dto/purchase-cable.dto");
const purchase_electricity_dto_1 = require("./dto/purchase-electricity.dto");
const validate_dto_1 = require("./dto/validate.dto");
let BillsController = class BillsController {
    bills;
    constructor(bills) {
        this.bills = bills;
    }
    validateMeter(user, dto) {
        return this.bills.validateMeter(dto.disco, dto.meterNumber, dto.meterType);
    }
    validateSmartCard(user, dto) {
        return this.bills.validateSmartCard(dto.serviceProvider, dto.smartCardNumber);
    }
    purchaseAirtime(user, dto) {
        return this.bills.purchaseAirtime(user.userId, dto);
    }
    purchaseData(user, dto) {
        return this.bills.purchaseData(user.userId, dto);
    }
    purchaseCable(user, dto) {
        return this.bills.purchaseCable(user.userId, dto);
    }
    purchaseElectricity(user, dto) {
        return this.bills.purchaseElectricity(user.userId, dto);
    }
    getServices() {
        return this.bills.getActiveServiceTypes();
    }
    getDataPlans(network = 'mtn') {
        return this.bills.getDataPlans(network);
    }
    getCablePlans(provider = 'dstv') {
        return this.bills.getCablePlans(provider);
    }
    getHistory(user) {
        return this.bills.getHistory(user.userId);
    }
    getReceipt(user, reference) {
        return this.bills.getReceipt(user.userId, reference);
    }
};
exports.BillsController = BillsController;
__decorate([
    (0, common_1.Post)('validate/meter'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, validate_dto_1.ValidateMeterDto]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "validateMeter", null);
__decorate([
    (0, common_1.Post)('validate/smart-card'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, validate_dto_1.ValidateSmartCardDto]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "validateSmartCard", null);
__decorate([
    (0, common_1.Post)('airtime'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, purchase_airtime_dto_1.PurchaseAirtimeDto]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "purchaseAirtime", null);
__decorate([
    (0, common_1.Post)('data'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, purchase_data_dto_1.PurchaseDataDto]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "purchaseData", null);
__decorate([
    (0, common_1.Post)('cable'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, purchase_cable_dto_1.PurchaseCableDto]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "purchaseCable", null);
__decorate([
    (0, common_1.Post)('electricity'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, purchase_electricity_dto_1.PurchaseElectricityDto]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "purchaseElectricity", null);
__decorate([
    (0, common_1.Get)('services'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "getServices", null);
__decorate([
    (0, common_1.Get)('data-plans'),
    __param(0, (0, common_1.Query)('network')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "getDataPlans", null);
__decorate([
    (0, common_1.Get)('cable-plans'),
    __param(0, (0, common_1.Query)('provider')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "getCablePlans", null);
__decorate([
    (0, common_1.Get)('history'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('receipts/:reference'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('reference')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillsController.prototype, "getReceipt", null);
exports.BillsController = BillsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('bills'),
    __metadata("design:paramtypes", [bills_service_1.BillsService])
], BillsController);
//# sourceMappingURL=bills.controller.js.map