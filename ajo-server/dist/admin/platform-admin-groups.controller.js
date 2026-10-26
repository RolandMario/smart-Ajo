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
exports.PlatformAdminGroupsController = void 0;
const common_1 = require("@nestjs/common");
const platform_admin_groups_service_1 = require("./platform-admin-groups.service");
const list_groups_query_dto_1 = require("./dto/list-groups-query.dto");
const update_service_fee_dto_1 = require("./dto/update-service-fee.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
let PlatformAdminGroupsController = class PlatformAdminGroupsController {
    platformAdminGroupsService;
    constructor(platformAdminGroupsService) {
        this.platformAdminGroupsService = platformAdminGroupsService;
    }
    list(query) {
        return this.platformAdminGroupsService.listGroups(query);
    }
    getDetail(id) {
        return this.platformAdminGroupsService.getGroupDetail(id);
    }
    updateServiceFee(id, dto) {
        return this.platformAdminGroupsService.updateServiceFee(id, dto.serviceFee);
    }
};
exports.PlatformAdminGroupsController = PlatformAdminGroupsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_groups_query_dto_1.ListGroupsQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminGroupsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlatformAdminGroupsController.prototype, "getDetail", null);
__decorate([
    (0, common_1.Patch)(':id/service-fee'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_service_fee_dto_1.UpdateServiceFeeDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminGroupsController.prototype, "updateServiceFee", null);
exports.PlatformAdminGroupsController = PlatformAdminGroupsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    (0, common_1.Controller)('admin/groups'),
    __metadata("design:paramtypes", [platform_admin_groups_service_1.PlatformAdminGroupsService])
], PlatformAdminGroupsController);
//# sourceMappingURL=platform-admin-groups.controller.js.map