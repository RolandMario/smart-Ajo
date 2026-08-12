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
exports.PlatformAdminUsersController = void 0;
const common_1 = require("@nestjs/common");
const platform_admin_users_service_1 = require("./platform-admin-users.service");
const list_users_query_dto_1 = require("./dto/list-users-query.dto");
const credit_wallet_dto_1 = require("./dto/credit-wallet.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
let PlatformAdminUsersController = class PlatformAdminUsersController {
    platformAdminUsersService;
    constructor(platformAdminUsersService) {
        this.platformAdminUsersService = platformAdminUsersService;
    }
    list(query) {
        return this.platformAdminUsersService.listUsers(query);
    }
    getDetail(id) {
        return this.platformAdminUsersService.getUserDetail(id);
    }
    creditWallet(id, dto) {
        return this.platformAdminUsersService.creditWallet(id, dto.amount, dto.note);
    }
};
exports.PlatformAdminUsersController = PlatformAdminUsersController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_users_query_dto_1.ListUsersQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminUsersController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlatformAdminUsersController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Post)(':id/wallet/credit'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, credit_wallet_dto_1.CreditWalletDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminUsersController.prototype, "creditWallet", null);
exports.PlatformAdminUsersController = PlatformAdminUsersController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    (0, common_1.Controller)('admin/users'),
    __metadata("design:paramtypes", [platform_admin_users_service_1.PlatformAdminUsersService])
], PlatformAdminUsersController);
//# sourceMappingURL=platform-admin-users.controller.js.map