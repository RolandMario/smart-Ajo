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
exports.PlatformAdminFinanceController = void 0;
const common_1 = require("@nestjs/common");
const platform_admin_finance_service_1 = require("./platform-admin-finance.service");
const list_wallet_transactions_query_dto_1 = require("./dto/list-wallet-transactions-query.dto");
const list_payouts_query_dto_1 = require("./dto/list-payouts-query.dto");
const list_group_wallet_transactions_query_dto_1 = require("./dto/list-group-wallet-transactions-query.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
let PlatformAdminFinanceController = class PlatformAdminFinanceController {
    financeService;
    constructor(financeService) {
        this.financeService = financeService;
    }
    listWalletTransactions(query) {
        return this.financeService.listWalletTransactions(query);
    }
    listPayouts(query) {
        return this.financeService.listPayouts(query);
    }
    listGroupWalletTransactions(query) {
        return this.financeService.listGroupWalletTransactions(query);
    }
};
exports.PlatformAdminFinanceController = PlatformAdminFinanceController;
__decorate([
    (0, common_1.Get)('wallet-transactions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_wallet_transactions_query_dto_1.ListWalletTransactionsQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminFinanceController.prototype, "listWalletTransactions", null);
__decorate([
    (0, common_1.Get)('payouts'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_payouts_query_dto_1.ListPayoutsQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminFinanceController.prototype, "listPayouts", null);
__decorate([
    (0, common_1.Get)('group-wallet-transactions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_group_wallet_transactions_query_dto_1.ListGroupWalletTransactionsQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminFinanceController.prototype, "listGroupWalletTransactions", null);
exports.PlatformAdminFinanceController = PlatformAdminFinanceController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    (0, common_1.Controller)('admin/finance'),
    __metadata("design:paramtypes", [platform_admin_finance_service_1.PlatformAdminFinanceService])
], PlatformAdminFinanceController);
//# sourceMappingURL=platform-admin-finance.controller.js.map