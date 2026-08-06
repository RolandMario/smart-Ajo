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
exports.PlatformAdminWalletController = void 0;
const common_1 = require("@nestjs/common");
const platform_admin_wallet_service_1 = require("./platform-admin-wallet.service");
const withdraw_admin_wallet_dto_1 = require("./dto/withdraw-admin-wallet.dto");
const set_bank_account_dto_1 = require("../wallet/dto/set-bank-account.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let PlatformAdminWalletController = class PlatformAdminWalletController {
    adminWalletService;
    constructor(adminWalletService) {
        this.adminWalletService = adminWalletService;
    }
    getAdminWallet() {
        return this.adminWalletService.getAdminWallet();
    }
    withdraw(user, dto) {
        return this.adminWalletService.withdraw(user.userId, dto.amount);
    }
    getBankAccount(user) {
        return this.adminWalletService.getBankAccount(user.userId);
    }
    setBankAccount(user, dto) {
        return this.adminWalletService.setBankAccount(user.userId, dto);
    }
    listBanks() {
        return this.adminWalletService.listBanks();
    }
};
exports.PlatformAdminWalletController = PlatformAdminWalletController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlatformAdminWalletController.prototype, "getAdminWallet", null);
__decorate([
    (0, common_1.Post)('withdraw'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, withdraw_admin_wallet_dto_1.WithdrawAdminWalletDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminWalletController.prototype, "withdraw", null);
__decorate([
    (0, common_1.Get)('bank-account'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PlatformAdminWalletController.prototype, "getBankAccount", null);
__decorate([
    (0, common_1.Post)('bank-account'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, set_bank_account_dto_1.SetBankAccountDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminWalletController.prototype, "setBankAccount", null);
__decorate([
    (0, common_1.Get)('banks'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlatformAdminWalletController.prototype, "listBanks", null);
exports.PlatformAdminWalletController = PlatformAdminWalletController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    (0, common_1.Controller)('admin/wallet'),
    __metadata("design:paramtypes", [platform_admin_wallet_service_1.PlatformAdminWalletService])
], PlatformAdminWalletController);
//# sourceMappingURL=platform-admin-wallet.controller.js.map