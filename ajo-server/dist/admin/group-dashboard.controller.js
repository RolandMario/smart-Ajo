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
exports.GroupDashboardController = void 0;
const common_1 = require("@nestjs/common");
const group_dashboard_service_1 = require("./group-dashboard.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let GroupDashboardController = class GroupDashboardController {
    dashboardService;
    constructor(dashboardService) {
        this.dashboardService = dashboardService;
    }
    listDefaulters(user, groupId) {
        return this.dashboardService.listCurrentDefaulters(user.userId, groupId);
    }
    getStandings(user, groupId) {
        return this.dashboardService.getMemberStandings(user.userId, groupId);
    }
    getContributionSummary(user, groupId) {
        return this.dashboardService.getContributionSummary(user.userId, groupId);
    }
};
exports.GroupDashboardController = GroupDashboardController;
__decorate([
    (0, common_1.Get)('defaulters'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GroupDashboardController.prototype, "listDefaulters", null);
__decorate([
    (0, common_1.Get)('standings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GroupDashboardController.prototype, "getStandings", null);
__decorate([
    (0, common_1.Get)('contribution-summary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GroupDashboardController.prototype, "getContributionSummary", null);
exports.GroupDashboardController = GroupDashboardController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('groups/:groupId/dashboard'),
    __metadata("design:paramtypes", [group_dashboard_service_1.GroupDashboardService])
], GroupDashboardController);
//# sourceMappingURL=group-dashboard.controller.js.map