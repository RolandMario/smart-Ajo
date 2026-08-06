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
exports.PlatformAdminManagementController = void 0;
const common_1 = require("@nestjs/common");
const platform_admin_management_service_1 = require("./platform-admin-management.service");
const create_platform_admin_dto_1 = require("./dto/create-platform-admin.dto");
const set_admin_active_dto_1 = require("./dto/set-admin-active.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let PlatformAdminManagementController = class PlatformAdminManagementController {
    managementService;
    constructor(managementService) {
        this.managementService = managementService;
    }
    list() {
        return this.managementService.listAdmins();
    }
    create(dto) {
        return this.managementService.createAdmin(dto);
    }
    setActive(user, id, dto) {
        return this.managementService.setActive(user.userId, id, dto.isActive);
    }
};
exports.PlatformAdminManagementController = PlatformAdminManagementController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlatformAdminManagementController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_platform_admin_dto_1.CreatePlatformAdminDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminManagementController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id/active'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, set_admin_active_dto_1.SetAdminActiveDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminManagementController.prototype, "setActive", null);
exports.PlatformAdminManagementController = PlatformAdminManagementController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    (0, common_1.Controller)('admin/admins'),
    __metadata("design:paramtypes", [platform_admin_management_service_1.PlatformAdminManagementService])
], PlatformAdminManagementController);
//# sourceMappingURL=platform-admin-management.controller.js.map