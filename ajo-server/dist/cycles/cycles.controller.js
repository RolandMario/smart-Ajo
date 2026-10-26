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
exports.CyclesController = void 0;
const common_1 = require("@nestjs/common");
const cycles_service_1 = require("./cycles.service");
const escrow_service_1 = require("./escrow.service");
const notify_bank_transfer_dto_1 = require("./dto/notify-bank-transfer.dto");
const reject_contribution_dto_1 = require("./dto/reject-contribution.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
let CyclesController = class CyclesController {
    cyclesService;
    escrowService;
    constructor(cyclesService, escrowService) {
        this.cyclesService = cyclesService;
        this.escrowService = escrowService;
    }
    activate(user, groupId) {
        return this.cyclesService.activateGroup(user.userId, groupId);
    }
    listCycles(user, groupId) {
        return this.cyclesService.listCycles(user.userId, groupId);
    }
    getCurrentCycle(user, groupId) {
        return this.cyclesService.getCurrentCycle(user.userId, groupId);
    }
    payFromWallet(user, groupId, contributionId) {
        return this.cyclesService.payContributionFromWallet(user.userId, groupId, contributionId);
    }
    notifyBankTransfer(user, groupId, contributionId, dto) {
        return this.cyclesService.notifyBankTransferPayment(user.userId, groupId, contributionId, dto.claimedReference);
    }
    confirmContribution(user, groupId, contributionId) {
        return this.cyclesService.confirmContributionPaid(user.userId, groupId, contributionId);
    }
    rejectContribution(user, groupId, contributionId, dto) {
        return this.cyclesService.rejectContributionPayment(user.userId, groupId, contributionId, dto.reason);
    }
    getEscrowAccount(user, groupId) {
        return this.escrowService.getEscrowAccount(user.userId, groupId);
    }
    refreshEscrowAccount(user, groupId) {
        return this.escrowService.refreshGroupEscrowAccount(user.userId, groupId);
    }
    listEscrowDeposits(user, groupId) {
        return this.escrowService.listDeposits(user.userId, groupId);
    }
    initiatePayout(user, groupId, cycleId) {
        return this.cyclesService.initiatePayout(user.userId, groupId, cycleId);
    }
};
exports.CyclesController = CyclesController;
__decorate([
    (0, common_1.Post)('activate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "activate", null);
__decorate([
    (0, common_1.Get)('cycles'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "listCycles", null);
__decorate([
    (0, common_1.Get)('cycles/current'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "getCurrentCycle", null);
__decorate([
    (0, common_1.Post)('contributions/:contributionId/pay'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Param)('contributionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "payFromWallet", null);
__decorate([
    (0, common_1.Post)('contributions/:contributionId/notify-transfer'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Param)('contributionId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, notify_bank_transfer_dto_1.NotifyBankTransferDto]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "notifyBankTransfer", null);
__decorate([
    (0, common_1.Post)('contributions/:contributionId/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Param)('contributionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "confirmContribution", null);
__decorate([
    (0, common_1.Post)('contributions/:contributionId/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Param)('contributionId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, reject_contribution_dto_1.RejectContributionDto]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "rejectContribution", null);
__decorate([
    (0, common_1.Get)('escrow-account'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "getEscrowAccount", null);
__decorate([
    (0, common_1.Post)('escrow-account/refresh'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "refreshEscrowAccount", null);
__decorate([
    (0, common_1.Get)('escrow-deposits'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "listEscrowDeposits", null);
__decorate([
    (0, common_1.Post)('cycles/:cycleId/payout'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('groupId')),
    __param(2, (0, common_1.Param)('cycleId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], CyclesController.prototype, "initiatePayout", null);
exports.CyclesController = CyclesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('groups/:groupId'),
    __metadata("design:paramtypes", [cycles_service_1.CyclesService,
        escrow_service_1.EscrowService])
], CyclesController);
//# sourceMappingURL=cycles.controller.js.map